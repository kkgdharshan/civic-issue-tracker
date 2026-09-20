export type IssueStatus = 'REPORTED' | 'TRIAGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_EMERGENCY';

export type IssueCategory = 
  | 'INFRASTRUCTURE'
  | 'PUBLIC_SAFETY'
  | 'ENVIRONMENTAL'
  | 'HAZARD'
  | 'UTILITIES';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  severity: SeverityLevel;
  upvoteCount: number;
  hasUpvoted: boolean;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  mediaUrls: string[];
  reporterId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  aiConfidence?: number;
}

export interface QueuedOfflineIssue {
  localId: string;
  payload: {
    title: string;
    description: string;
    category: IssueCategory;
    severity: SeverityLevel;
    latitude: number;
    longitude: number;
  };
  imageBlob?: Blob;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  retryCount: number;
  queuedAt: number;
  lastAttemptAt?: number;
  error?: string;
}

export interface ClusterPointProperties {
  cluster: boolean;
  issueId?: string;
  status?: IssueStatus;
  severity?: SeverityLevel;
  title?: string;
  point_count?: number;
  point_count_abbreviated?: string | number;
}

export type ClusterFeature = GeoJSON.Feature<GeoJSON.Point, ClusterPointProperties>;
