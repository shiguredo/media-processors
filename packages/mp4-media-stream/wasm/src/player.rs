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
                .map(|t| TrackPlayer::new(player_id, t))
                .collect::<orfail::Result<_>>()
                .expect("unreachable"),
        }
    }

    fn now(&self) -> Duration {
        WasmApi::now().saturating_sub(self.start_time)
    }

    fn next_timestamp(&self) -> Duration {
        // TODO: repeat を考慮する
        self.tracks
            .iter()
            .map(|t| t.current_position())
            .min()
            .expect("unreachable")
    }

    pub async fn run(mut self) {
        loop {
            // TODO: 数フレーム分は先読みしてデコードしておく
            while self.run_one() {
                // TODO: sleep until next sample timestamp

                // 次のサンプルのタイムスタンプまで待つ
                // TODO: 遅れている場合にはフレームスキップをするかも
                let now = self.now();
                let wait_duration = self.next_timestamp().saturating_sub(now);
                WasmApi::sleep(wait_duration).await;
            }
            if !self.repeat {
                break;
            }

            self.timestamp_offset += self.next_timestamp(); // TODO: duration を足すべき？
            self.start_time = WasmApi::now();
            for track in &mut self.tracks {
                track.current_sample_index = NonZeroU32::MIN;
            }
        }

        WasmApi::notify_eos(self.player_id);
    }

    fn run_one(&mut self) -> bool {
        // TODO: sample entry が変わったらデコーダを作り直す or configure() を呼び直す
        let now = self.now();

        for track in &mut self.tracks {
            if track.decoder.is_none() {
                let decoder = match track.sample_table.stbl_box().stsd_box.entries.first() {
                    Some(SampleEntry::Avc1(b)) => {
                        let config = VideoDecoderConfig::from_avc1_box(b);
                        WasmApi::create_video_decoder(self.player_id, config)
                    }
                    Some(SampleEntry::Opus(b)) => {
                        let config = AudioDecoderConfig::from_opus_box(b);
                        WasmApi::create_audio_decoder(self.player_id, config)
                    }
                    _ => unreachable!(),
                };
                track.decoder = Some(decoder);
            };
        }

        for track in &self.tracks {
            if now < track.current_position() {
                continue;
            }
            self.render_sample(track);
        }

        for track in &mut self.tracks {
            if now < track.current_position() {
                continue;
            }

            track.current_sample_index = track.current_sample_index.saturating_add(1);
            if track.current_sample_index.get() + 1 == track.sample_table.sample_count() {
                // TODO: 尺が長い方に合わせる
                return false;
            }
        }

        true
    }

    fn render_sample(&self, track: &TrackPlayer) {
        let sample = track.current_sample();
        let data = &self.mp4_bytes[sample.data_offset() as usize..][..sample.data_size() as usize];
        WasmApi::render(
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

    fn current_sample(&self) -> SampleAccessor<StblBox> {
        self.sample_table
            .get_sample(self.current_sample_index)
            .expect("unreachable")
    }

    fn current_position(&self) -> Duration {
        let sample = self.current_sample();
        Duration::from_secs(sample.timestamp()) / self.timescale.get()
    }
}

impl Drop for TrackPlayer {
    fn drop(&mut self) {
        if let Some(decoder) = self.decoder {
            WasmApi::close_decoder(self.player_id, decoder);
        }
    }
}
