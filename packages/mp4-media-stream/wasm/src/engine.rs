use std::{collections::HashMap, rc::Rc};

use futures::{executor::LocalPool, future::RemoteHandle, task::LocalSpawnExt};
use orfail::OrFail;

use crate::{
    mp4::{Mp4, Mp4Info, Track},
    player::{PlayOptions, Player, PlayerId},
};

#[derive(Debug)]
pub struct Engine {
    mp4_bytes: Rc<Vec<u8>>,
    tracks: Vec<Track>,
    executor: LocalPool,
    executing: bool,
    players: HashMap<PlayerId, RemoteHandle<()>>,
}

impl Engine {
    #[expect(clippy::new_without_default)]
    pub fn new() -> Self {
        Self {
            mp4_bytes: Rc::new(Vec::new()),
            tracks: Vec::new(),
            executor: LocalPool::new(),
            executing: false,
            players: HashMap::new(),
        }
    }

    pub fn load_mp4(&mut self, mp4_bytes: Vec<u8>) -> orfail::Result<Mp4Info> {
        (self.tracks.is_empty()).or_fail()?;

        let mp4 = Mp4::load(&mp4_bytes).or_fail()?;
        self.mp4_bytes = Rc::new(mp4_bytes);
        self.tracks = mp4.tracks;

        Ok(mp4.info)
    }

    pub fn play(&mut self, player_id: PlayerId, options: PlayOptions) {
        // MP4 はロード済みであるのが前提
        assert!(!self.tracks.is_empty());

        let player = Player::new(player_id, options, self.mp4_bytes.clone(), &self.tracks);
        self.players.insert(
            player_id,
            self.executor
                .spawner()
                .spawn_local_with_handle(player.run())
                .expect("unreachable"),
        );
        self.poll();
    }

    pub fn stop(&mut self, player_id: PlayerId) {
        let _ = self.players.remove(&player_id);
        self.poll();
    }

    pub fn poll(&mut self) {
        if self.executing {
            return;
        }
        self.executing = true;
        self.executor.run_until_stalled();
        self.executing = false;
    }
}
