use std::{collections::HashSet, num::NonZeroU32, rc::Rc};

use orfail::{Failure, OrFail};
use serde::Serialize;
use shiguredo_mp4::{
    aux::SampleTableAccessor,
    boxes::{
        Avc1Box, FtypBox, HdlrBox, IgnoredBox, MoovBox, OpusBox, SampleEntry, StblBox, TrakBox,
    },
    BaseBox, Decode, Either, Encode,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoDecoderConfig {
    pub codec: String,
    pub description: Vec<u8>,
    pub coded_width: u16,
    pub coded_height: u16,
}

impl VideoDecoderConfig {
    pub fn from_avc1_box(b: &Avc1Box) -> Self {
        let mut description = Vec::new();
        b.avcc_box.encode(&mut description).expect("unreachable");
        description.drain(..8); // ボックスヘッダ部分を取り除く

        Self {
            codec: format!(
                "avc1.{:02x}{:02x}{:02x}",
                b.avcc_box.avc_profile_indication,
                b.avcc_box.profile_compatibility,
                b.avcc_box.avc_level_indication
            ),
            description,
            coded_width: b.visual.width,
            coded_height: b.visual.height,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDecoderConfig {
    pub codec: String,
    pub sample_rate: u16,
    pub number_of_channels: u8,
}

impl AudioDecoderConfig {
    pub fn from_opus_box(b: &OpusBox) -> Self {
        Self {
            codec: "opus".to_owned(),
            sample_rate: b.audio.samplerate.integer,
            number_of_channels: b.audio.channelcount as u8,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mp4Info {
    pub audio_configs: Vec<AudioDecoderConfig>,
    pub video_configs: Vec<VideoDecoderConfig>,
}

#[derive(Debug, Clone)]
pub struct Track {
    pub sample_table: Rc<SampleTableAccessor<StblBox>>,
    pub timescale: NonZeroU32,
}

impl Track {
    pub fn new(trak_box: TrakBox) -> orfail::Result<Self> {
        let timescale = trak_box.mdia_box.mdhd_box.timescale;
        let sample_table =
            SampleTableAccessor::new(trak_box.mdia_box.minf_box.stbl_box).or_fail()?;
        (sample_table.sample_count() > 0).or_fail()?;

        match sample_table.stbl_box().stsd_box.entries.first() {
            Some(SampleEntry::Avc1(_)) => (),
            Some(SampleEntry::Opus(_)) => (),
            Some(b) => {
                let kind = match trak_box.mdia_box.hdlr_box.handler_type {
                    HdlrBox::HANDLER_TYPE_SOUN => "audio ",
                    HdlrBox::HANDLER_TYPE_VIDE => "video ",
                    _ => "",
                };
                return Err(Failure::new(format!(
                    "Unsupported {}codec: {}",
                    kind,
                    b.box_type()
                )));
            }
            None => {
                // MP4 デコード時にチェック済みなので、ここには来ない
                unreachable!()
            }
        };
        Ok(Self {
            sample_table: Rc::new(sample_table),
            timescale,
        })
    }
}

#[derive(Debug)]
pub struct Mp4 {
    pub info: Mp4Info,
    pub tracks: Vec<Track>,
}

impl Mp4 {
    pub fn load(mp4_bytes: &[u8]) -> orfail::Result<Self> {
        let moov_box = Self::load_moov_box(mp4_bytes).or_fail()?;

        let mut audio_track_count = 0;
        let mut video_track_count = 0;
        let mut tracks = Vec::new();
        for trak_box in moov_box.trak_boxes {
            if trak_box.mdia_box.hdlr_box.handler_type == HdlrBox::HANDLER_TYPE_SOUN {
                audio_track_count += 1;
            } else if trak_box.mdia_box.hdlr_box.handler_type == HdlrBox::HANDLER_TYPE_VIDE {
                video_track_count += 1;
            }

            tracks.push(Track::new(trak_box).or_fail()?);
        }
        (!tracks.is_empty()).or_fail_with(|()| "No video or audio tracks found".to_owned())?;
        (audio_track_count <= 1)
            .or_fail_with(|()| "Unsupported: multiple audio tracks".to_owned())?;
        (video_track_count <= 1)
            .or_fail_with(|()| "Unsupported: multiple video tracks".to_owned())?;

        Ok(Self {
            info: Self::get_mp4_info(&tracks),
            tracks,
        })
    }

    fn load_moov_box(mut reader: &[u8]) -> orfail::Result<MoovBox> {
        FtypBox::decode(&mut reader).or_fail()?;
        loop {
            if reader.is_empty() {
                return Err(Failure::new("No 'moov' box found"));
            }
            if let Either::A(moov_box) =
                IgnoredBox::decode_or_ignore(&mut reader, |ty| ty == MoovBox::TYPE).or_fail()?
            {
                return Ok(moov_box);
            }
        }
    }

    fn get_mp4_info(tracks: &[Track]) -> Mp4Info {
        let mut audio_configs = Vec::new();
        let mut video_configs = Vec::new();
        let mut known_sample_entries = HashSet::new();
        for track in tracks {
            for chunk in track.sample_table.chunks() {
                if known_sample_entries.contains(chunk.sample_entry()) {
                    continue;
                }
                known_sample_entries.insert(chunk.sample_entry().clone());

                match chunk.sample_entry() {
                    SampleEntry::Avc1(b) => {
                        video_configs.push(VideoDecoderConfig::from_avc1_box(b));
                    }
                    SampleEntry::Opus(b) => {
                        audio_configs.push(AudioDecoderConfig::from_opus_box(b));
                    }
                    _ => {
                        // `Track` 作成時にチェックしているのでここには来ない
                        unreachable!()
                    }
                }
            }
        }

        Mp4Info {
            audio_configs,
            video_configs,
        }
    }
}
