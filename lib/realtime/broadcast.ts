import { CivicIssue } from '@/types/issue';

export type RealtimeEvent =
  | { type: 'ISSUE_CREATED'; payload: CivicIssue }
  | { type: 'ISSUE_RESOLVED'; payload: { issueId: string; resolvedAt: string } }
  | { type: 'ISSUE_STATUS_CHANGED'; payload: { issueId: string; newStatus: CivicIssue['status'] } }
  | { type: 'UPVOTE_SYNC'; payload: { issueId: string; upvoteCount: number } };

class RealtimeChannel {
  private channel: BroadcastChannel | null = null;
  private listeners: ((event: RealtimeEvent) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('civicpulse_realtime_stream');
      this.channel.onmessage = (messageEvent) => {
        this.emitLocal(messageEvent.data);
      };
    }
  }

  public subscribe(callback: (event: RealtimeEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public publish(event: RealtimeEvent) {
    if (this.channel) {
      this.channel.postMessage(event);
    }
    this.emitLocal(event);
  }

  private emitLocal(event: RealtimeEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Realtime subscriber exception', err);
      }
    });
  }
}

export const realtimeChannel = new RealtimeChannel();
