use std::{num::NonZeroU32, rc::Rc, time::Duration};

use serde::Deserialize;
use shiguredo_mp4::{
    aux::{SampleAccessor, SampleTableAccessor},
    boxes::{SampleEntry, StblBox},
};

use crate::{
    mp4::{AudioDecoderConfig, Track, VideoDecoderConfig},
    wasm::{DecoderId, WasmApi},
};

pub type PlayerId = u32;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayOptions {
    #[serde(default)]
    pub repeat: bool,
}

#[derive(Debug)]
pub struct Player {
    player_id: PlayerId,
    start_time: Duration,
    mp4_bytes: Rc<Vec<u8>>,
    tracks: Vec<TrackPlayer>,
    repeat: bool,
    timestamp_offset: Duration,
}

impl Player {
    pub fn new(
        player_id: PlayerId,
        options: PlayOptions,
        mp4_bytes: Rc<Vec<u8>>,
        tracks: &[Track],
    ) -> Self {
        Self {
            player_id,
            start_time: WasmApi::now(),
            mp4_bytes,
            repeat: options.repeat,
            timestamp_offset: Duration::ZERO,
            tracks: tracks
                .iter()
                .map(|track| TrackPlayer::new(player_id, track))
                .collect::<orfail::Result<_>>()
                .expect("unreachable"),
        }
    }

    // 再生開始からの経過時間を返す
    fn elapsed(&self) -> Duration {
        WasmApi::now().saturating_sub(self.start_time)
    }

    // 再生時刻が一番近いサンプルのタイムスタンプを返す
    // 全てのトラックが終端に達している場合には None が返される
    fn next_timestamp(&self) -> Option<Duration> {
        self.tracks
            .iter()
            .filter(|t| !t.eos())
            .map(|t| t.current_timestamp())
            .min()
    }

    // ファイル全体の尺を返す
    fn file_duration(&self) -> Duration {
        self.tracks
            .iter()
            .map(|t| t.duration())
            .max()
            .expect("unreachable")
    }

    pub async fn run(mut self) {
        loop {
            while let Some(wait) = self
                .next_timestamp()
                .map(|t| t.saturating_sub(self.elapsed()))
            {
                // 次のサンプルのタイムスタンプまで待つ
                WasmApi::sleep(wait).await;

                self.run_one().await;
            }

            if !self.repeat {
                break;
            }

            // 繰り返し再生を行う場合には、開始時刻を調整する
            self.timestamp_offset += self.file_duration();
            self.start_time = WasmApi::now();
            for track in &mut self.tracks {
                track.current_sample_index = NonZeroU32::MIN;
            }
        }

        WasmApi::notify_eos(self.player_id);
    }

    async fn run_one(&mut self) {
        let now = self.elapsed();

        for track in &mut self.tracks {
            track.maybe_setup_decoder().await;
        }

        for track in &self.tracks {
            if track.eos() || now < track.current_timestamp() {
                continue;
            }
            self.decode_sample(track);
            break;
        }

        for track in &mut self.tracks {
            if track.eos() || now < track.current_timestamp() {
                continue;
            }

            track.current_sample_index = track.current_sample_index.saturating_add(1);
            return;
        }
    }

    fn decode_sample(&self, track: &TrackPlayer) {
        let sample = track.current_sample();
        let data = &self.mp4_bytes[sample.data_offset() as usize..][..sample.data_size() as usize];

        // Rust 側で関与するのはデコードのトリガーを引くところまでで、その先の処理は TypeScript 側で行われる
        WasmApi::decode(
            self.player_id,
            track.decoder.expect("unreachable"),
            track.timescale,
            self.timestamp_offset,
            sample,
            data,
        );
    }
}

#[derive(Debug, Clone)]
struct TrackPlayer {
    player_id: PlayerId,
    sample_table: Rc<SampleTableAccessor<StblBox>>,
    decoder: Option<DecoderId>,
    timescale: NonZeroU32,
    current_sample_index: NonZeroU32,
}

impl TrackPlayer {
    fn new(player_id: PlayerId, track: &Track) -> orfail::Result<Self> {
        Ok(TrackPlayer {
            player_id,
            sample_table: track.sample_table.clone(),
            decoder: None,
            timescale: track.timescale,
            current_sample_index: NonZeroU32::MIN,
        })
    }

    async fn maybe_setup_decoder(&mut self) {
        if self.eos() {
            return;
        }
        if self.decoder.is_some() && !self.is_sample_entry_changed() {
            return;
        }

        if let Some(decoder) = self.decoder {
            WasmApi::close_decoder(self.player_id, decoder);
        }

        let decoder = match self.current_sample().chunk().sample_entry() {
            SampleEntry::Avc1(b) => {
                let config = VideoDecoderConfig::from_avc1_box(b);
                WasmApi::create_video_decoder(self.player_id, config).await
            }
            SampleEntry::Vp08(b) => {
                let config = VideoDecoderConfig::from_vp08_box(b);
                WasmApi::create_video_decoder(self.player_id, config).await
            }
            SampleEntry::Vp09(b) => {
                let config = VideoDecoderConfig::from_vp09_box(b);
                WasmApi::create_video_decoder(self.player_id, config).await
            }
            SampleEntry::Opus(b) => {
                let config = AudioDecoderConfig::from_opus_box(b);
                WasmApi::create_audio_decoder(self.player_id, config).await
            }
            SampleEntry::Mp4a(b) => {
                let config = AudioDecoderConfig::from_mp4a_box(b);
                WasmApi::create_audio_decoder(self.player_id, config).await
            }
            _ => {
                // MP4::load() の中で非対応コーデックのチェックは行っているので、ここに来ることはない
                unreachable!()
            }
        };
        self.decoder = Some(decoder);
    }

    fn is_sample_entry_changed(&self) -> bool {
        // `Mp4::load()` の中で空サンプルがないことは確認済みなので、以降の処理が失敗することはない
        let prev_sample_index = NonZeroU32::new(self.current_sample_index.get() - 1)
            .or_else(|| self.sample_table.samples().last().map(|s| s.index()))
            .expect("unreachable");
        let prev_sample = self
            .sample_table
            .get_sample(prev_sample_index)
            .expect("unreachable");
        let current_sample = self
            .sample_table
            .get_sample(self.current_sample_index)
            .expect("unreachable");
        prev_sample.chunk().sample_entry() != current_sample.chunk().sample_entry()
    }

    fn current_sample(&self) -> SampleAccessor<StblBox> {
        self.sample_table
            .get_sample(self.current_sample_index)
            .expect("unreachable")
    }

    fn current_timestamp(&self) -> Duration {
        let sample = self.current_sample();
        Duration::from_secs(sample.timestamp()) / self.timescale.get()
    }

    fn duration(&self) -> Duration {
        let last = self.sample_table.samples().last().expect("unreachable");
        Duration::from_secs(last.timestamp() + last.duration() as u64) / self.timescale.get()
    }

    fn eos(&self) -> bool {
        self.current_sample_index.get() + 1 == self.sample_table.sample_count()
    }
}

impl Drop for TrackPlayer {
    fn drop(&mut self) {
        if let Some(decoder) = self.decoder {
            WasmApi::close_decoder(self.player_id, decoder);
        }
    }
}
