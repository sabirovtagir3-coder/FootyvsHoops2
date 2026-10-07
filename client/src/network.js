import { io } from 'socket.io-client';

export class NetworkService {
  constructor(serverUrl) {
    this.socket = io(serverUrl, { autoConnect: true });
    
    this.onAuthSuccess = null;
    this.onLeaderboard = null;
    this.onMatchFound = null;
    this.onCountdownTick = null;
    this.onMatchStart = null;
    this.onSyncState = null;
    this.onGoal = null;
    this.onMatchResult = null;
    this.onOpponentDisconnect = null;

    this.initListeners();
  }

  initListeners() {
    this.socket.on('auth_success', (data) => this.onAuthSuccess?.(data));
    this.socket.on('leaderboard_data', (data) => this.onLeaderboard?.(data));
    this.socket.on('match_found', (data) => this.onMatchFound?.(data));
    this.socket.on('countdown_tick', (num) => this.onCountdownTick?.(num));
    this.socket.on('match_start', () => this.onMatchStart?.());
    this.socket.on('sync_state', (state) => this.onSyncState?.(state));
    this.socket.on('goal_celebration', (ev) => this.onGoal?.(ev));
    this.socket.on('match_result', (res) => this.onMatchResult?.(res));
    this.socket.on('opponent_disconnected', () => this.onOpponentDisconnect?.());
  }

  auth(tgUser, team) {
    this.socket.emit('auth_player', { tgUser, team });
  }

  fetchLeaderboard() {
    this.socket.emit('get_leaderboard');
  }

  findMatch(mode) {
    this.socket.emit('find_match', { mode });
  }

  cancelSearch() {
    this.socket.emit('cancel_search');
  }

  sendInput(dx, dz, turbo, shoot) {
    this.socket.emit('client_input', { dx, dz, turbo, shoot });
  }

  getSocketId() {
    return this.socket.id;
  }
}