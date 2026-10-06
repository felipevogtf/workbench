export class ReviewTicketDto {
  key!: string;
  title!: string | null;
  state!: string | null;
  found!: boolean;
  url!: string;
}

export class ReviewResponseDto {
  id!: string;
  pullRequestId!: string;
  commit!: string | null;
  agentId!: string | null;
  agentName!: string | null;
  model!: string | null;
  docPath!: string | null;
  status!: string;
  error!: string | null;
  commentStatus!: string;
  commentUrl!: string | null;
  commentError!: string | null;
  tickets!: ReviewTicketDto[];
  createdAt!: Date;
}
