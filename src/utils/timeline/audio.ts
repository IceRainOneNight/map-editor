import type { AudioTrackData } from '../../types/timeline';

/** 音频播放管理器 */
export class AudioPlaybackManager {
  private ctx: AudioContext | null = null;
  private sources: { source: AudioBufferSourceNode; gain: GainNode; trackId: string; startTime: number; offset: number }[] = [];
  private _startWallTime = 0;

  /** 获取或创建 AudioContext（需用户交互后创建） */
  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 开始播放所有音频轨道 */
  start(tracks: { trackId: string; audioData: AudioTrackData; volume: number; startTime: number }[]): void {
    this.stop();

    const ctx = this.getContext();
    this._startWallTime = ctx.currentTime;

    for (const track of tracks) {
      if (!track.audioData) continue;

      const source = ctx.createBufferSource();
      source.buffer = track.audioData.buffer;

      const gain = ctx.createGain();
      gain.gain.value = track.volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      source.start(0, track.startTime);

      this.sources.push({
        source,
        gain,
        trackId: track.trackId,
        startTime: track.startTime,
        offset: 0,
      });
    }
  }

  /** 暂停音频 */
  pause(): void {
    if (!this.ctx) return;
    this.ctx.suspend();
  }

  /** 恢复播放 */
  resume(): void {
    if (!this.ctx) return;
    this.ctx.resume();
  }

  /** 停止并清理所有音频 */
  stop(): void {
    for (const s of this.sources) {
      try {
        s.source.stop();
      } catch {}
      try {
        s.source.disconnect();
      } catch {}
      try {
        s.gain.disconnect();
      } catch {}
    }
    this.sources = [];
  }

  /** 跳转到指定时间（重新创建音频源） */
  seek(tracks: { trackId: string; audioData: AudioTrackData; volume: number; startTime: number }[], time: number): void {
    this.stop();

    if (tracks.length === 0) return;

    const ctx = this.getContext();
    this._startWallTime = ctx.currentTime - time;

    for (const track of tracks) {
      if (!track.audioData) continue;

      const offset = track.startTime + time - track.startTime;
      if (offset < 0 || offset > track.audioData.duration) continue;

      const source = ctx.createBufferSource();
      source.buffer = track.audioData.buffer;

      const gain = ctx.createGain();
      gain.gain.value = track.volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      source.start(0, offset);

      this.sources.push({
        source,
        gain,
        trackId: track.trackId,
        startTime: time,
        offset,
      });
    }
  }

  /** 更新某个轨道的音量 */
  updateVolume(trackId: string, volume: number): void {
    for (const s of this.sources) {
      if (s.trackId === trackId) {
        s.gain.gain.value = volume;
      }
    }
  }

  /** 清理 */
  dispose(): void {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  /** 获取音频通道用于导出 */
  createCaptureStream(): MediaStreamAudioDestinationNode | null {
    const ctx = this.getContext();
    return ctx.createMediaStreamDestination();
  }
}

let _audioManager: AudioPlaybackManager | null = null;

export function getAudioManager(): AudioPlaybackManager {
  if (!_audioManager) {
    _audioManager = new AudioPlaybackManager();
  }
  return _audioManager;
}

export function resetAudioManager(): void {
  if (_audioManager) {
    _audioManager.dispose();
    _audioManager = null;
  }
}
