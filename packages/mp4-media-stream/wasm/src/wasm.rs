use std::{marker::PhantomData, num::NonZeroU32, time::Duration};

use futures::{channel::oneshot, TryFutureExt};
use orfail::OrFail;
use serde::{Deserialize, Serialize};
use shiguredo_mp4::{aux::SampleAccessor, boxes::StblBox};

use crate::{
    engine::Engine,
    mp4::{AudioDecoderConfig, Mp4Info, VideoDecoderConfig},
    player::{PlayOptions, PlayerId},
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncodedChunkMetadata {
    #[serde(rename = "type")]
    pub ty: &'static str, // key | delta
    pub timestamp: u32, // millis
    pub duration: u32,  // millis
}

#[derive(Debug)]
pub struct WasmApi;

impl WasmApi {
    pub fn now() -> Duration {
        Duration::from_secs_f64(unsafe { now() / 1000.0 })
    }

    pub async fn sleep(duration: Duration) {
        let (tx, rx) = oneshot::channel::<()>();
        unsafe { sleep(Box::into_raw(Box::new(tx)), duration.as_millis() as u32) };
        rx.unwrap_or_else(|_| ()).await;
    }

    pub fn create_video_decoder(player_id: PlayerId, config: VideoDecoderConfig) -> DecoderId {
        unsafe {
            createVideoDecoder(player_id, JsonVec::new(config));
        }

        // TODO: 結果を返さなくする
        0
    }

    pub fn create_audio_decoder(player_id: PlayerId, config: AudioDecoderConfig) -> DecoderId {
        unsafe {
            createAudioDecoder(player_id, JsonVec::new(config));
        }

        // TODO: 結果を返さなくする
        1
    }

    pub fn render(
        player_id: PlayerId,
        decoder: DecoderId,
        timescale: NonZeroU32,
        timestamp_offset: Duration,
        sample: SampleAccessor<'_, StblBox>,
        sample_data: &[u8],
    ) {
        let metadata = EncodedChunkMetadata {
            ty: if sample.is_sync_sample() {
                "key"
            } else {
                "delta"
            },
            timestamp: (Duration::from_secs(sample.timestamp()) / timescale.get()
                + timestamp_offset)
                .as_millis() as u32,
            duration: (Duration::from_secs(sample.duration() as u64) / timescale.get()).as_millis()
                as u32,
        };
        unsafe {
            decode(
                player_id,
                decoder,
                JsonVec::new(metadata),
                sample_data.as_ptr(),
                sample_data.len() as u32,
            );
        }
    }

    pub fn close_decoder(player_id: PlayerId, decoder: DecoderId) {
        unsafe { closeDecoder(player_id, decoder) }
    }

    pub fn notify_eos(player_id: PlayerId) {
        unsafe { notifyEos(player_id) }
    }
}

pub type DecoderId = u32;

extern "C" {
    #[expect(improper_ctypes)]
    pub fn consoleLog(messageWasmJson: JsonVec<String>);

    pub fn now() -> f64;

    #[expect(improper_ctypes)]
    pub fn sleep(result_tx: *mut oneshot::Sender<()>, duration: u32);

    #[expect(improper_ctypes)]
    pub fn decode(
        player_id: PlayerId,
        decoder: DecoderId,
        metadata: JsonVec<EncodedChunkMetadata>,
        data_ptr: *const u8,
        data_len: u32,
    );

    #[expect(improper_ctypes)]
    pub fn createVideoDecoder(player_id: PlayerId, config: JsonVec<VideoDecoderConfig>);

    #[expect(improper_ctypes)]
    pub fn createAudioDecoder(player_id: PlayerId, config: JsonVec<AudioDecoderConfig>);

    pub fn closeDecoder(player_id: PlayerId, decoder: DecoderId);

    pub fn notifyEos(player_id: PlayerId);
}

#[no_mangle]
#[expect(clippy::not_unsafe_ptr_arg_deref)]
pub fn awake(engine: *mut Engine, result_tx: *mut oneshot::Sender<()>) {
    let is_ok = unsafe { Box::from_raw(result_tx) }.send(()).is_ok();
    if !is_ok {
        return;
    }
    unsafe { &mut *engine }.poll();
}

#[no_mangle]
#[expect(non_snake_case)]
pub fn newEngine() -> *mut Engine {
    std::panic::set_hook(Box::new(|info| {
        let msg = info.to_string();
        unsafe {
            consoleLog(JsonVec::new(msg));
        }
    }));

    Box::into_raw(Box::new(Engine::new()))
}

#[no_mangle]
#[expect(non_snake_case, clippy::not_unsafe_ptr_arg_deref)]
pub fn freeEngine(engine: *mut Engine) {
    let _ = unsafe { Box::from_raw(engine) };
}

#[no_mangle]
#[expect(non_snake_case, clippy::not_unsafe_ptr_arg_deref)]
pub fn loadMp4(engine: *mut Engine, mp4_bytes: *mut Vec<u8>) -> JsonVec<orfail::Result<Mp4Info>> {
    let engine = unsafe { &mut *engine };
    let result = engine
        .load_mp4(*unsafe { Box::from_raw(mp4_bytes) })
        .or_fail();
    JsonVec::new(result)
}

#[no_mangle]
#[expect(clippy::not_unsafe_ptr_arg_deref)]
pub fn play(engine: *mut Engine, player_id: PlayerId, options: JsonVec<PlayOptions>) {
    let engine = unsafe { &mut *engine };
    let options = unsafe { options.into_value() };
    engine.play(player_id, options);
}

#[no_mangle]
#[expect(clippy::not_unsafe_ptr_arg_deref)]
pub fn stop(engine: *mut Engine, player_id: PlayerId) {
    let engine = unsafe { &mut *engine };
    engine.stop(player_id)
}

#[no_mangle]
#[expect(non_snake_case, clippy::not_unsafe_ptr_arg_deref)]
pub fn vecOffset(v: *mut Vec<u8>) -> *mut u8 {
    unsafe { &mut *v }.as_mut_ptr()
}

#[no_mangle]
#[expect(non_snake_case, clippy::not_unsafe_ptr_arg_deref)]
pub fn vecLen(v: *mut Vec<u8>) -> i32 {
    unsafe { &*v }.len() as i32
}

#[no_mangle]
#[expect(non_snake_case)]
pub fn allocateVec(len: i32) -> *mut Vec<u8> {
    Box::into_raw(Box::new(vec![0; len as usize]))
}

#[no_mangle]
#[expect(non_snake_case, clippy::not_unsafe_ptr_arg_deref)]
pub fn freeVec(v: *mut Vec<u8>) {
    let _ = unsafe { Box::from_raw(v) };
}

#[repr(transparent)]
pub struct JsonVec<T> {
    bytes: *mut Vec<u8>,
    _ty: PhantomData<T>,
}

impl<T: Serialize> JsonVec<T> {
    fn new(value: T) -> Self {
        let bytes = Box::into_raw(Box::new(serde_json::to_vec(&value).expect("unreachable")));
        Self {
            bytes,
            _ty: PhantomData,
        }
    }
}

impl<T: for<'de> Deserialize<'de>> JsonVec<T> {
    #[track_caller]
    unsafe fn into_value(self) -> T {
        let bytes = Box::from_raw(self.bytes);
        let value: T = serde_json::from_slice(&bytes).expect("Invalid JSON");
        value
    }
}
