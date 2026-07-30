import { IssueProps } from './issue.props';

export class Issue {
  private constructor(private props: IssueProps) {
    this.validateIdentity();
    this.validateDates();
    this.validateEstimatedHours();
  }

  static createLocal(
    data: Pick<IssueProps, 'name' | 'projectId' | 'description'>,
  ): Issue {
    return new Issue({
      ...data,
      id: crypto.randomUUID(),
      isLocal: true,
      externalId: null,
      sequenceNumber: null,
      localId: null,
      externalState: null,
      priority: null,
      stateId: null,
      labelIds: [],
      startDate: null,
      dueDate: null,
      estimatedHours: null,
      syncedAt: new Date(),
      createdAt: new Date(),
    });
  }

  static reconstruct(props: IssueProps): Issue {
    return new Issue(props);
  }

  syncFromRemote(
    data: Pick<
      IssueProps,
      | 'name'
      | 'description'
      | 'externalState'
      | 'priority'
      | 'sequenceNumber'
      | 'startDate'
      | 'dueDate'
    >,
  ): void {
    this.props.name = data.name;
    this.props.description = data.description;
    this.props.externalState = data.externalState;
    this.props.priority = data.priority;
    this.props.sequenceNumber = data.sequenceNumber;
    this.props.startDate = data.startDate;
    this.props.dueDate = data.dueDate;
    this.props.syncedAt = new Date();

    const prevStart = this.props.startDate;
    const prevDue = this.props.dueDate;
    this.props.startDate = data.startDate;
    this.props.dueDate = data.dueDate;
    try {
      this.validateDates();
    } catch (e) {
      this.props.startDate = prevStart;
      this.props.dueDate = prevDue;
      throw e;
    }
  }

  private validateIdentity() {
    if (this.props.isLocal && this.props.externalId !== null) {
      throw new Error('Local issue cannot have an externalId');
    }

    if (!this.props.isLocal && this.props.externalId === null) {
      throw new Error('Non-local issue must have an externalId');
    }
  }

  private validateDates() {
    const { startDate, dueDate } = this.props;
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      throw new Error('Start date cannot be after due date');
    }
  }

  private validateEstimatedHours() {
    const { estimatedHours } = this.props;
    if (estimatedHours !== null && estimatedHours < 0) {
      throw new Error('Estimated hours cannot be negative');
    }
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get isLocal(): boolean {
    return this.props.isLocal;
  }

  get externalId(): string | null {
    return this.props.externalId;
  }

  get startDate(): string | null {
    return this.props.startDate;
  }

  get dueDate(): string | null {
    return this.props.dueDate;
  }

  get description(): string | null {
    return this.props.description;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get labelIds(): string[] {
    return this.props.labelIds;
  }

  get syncedAt(): Date {
    return this.props.syncedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get stateId(): string | null {
    return this.props.stateId;
  }

  get localId(): number | null {
    return this.props.localId;
  }

  get sequenceNumber(): number | null {
    return this.props.sequenceNumber;
  }

  get externalState(): string | null {
    return this.props.externalState;
  }

  get priority(): string | null {
    return this.props.priority;
  }

  get estimatedHours(): number | null {
    return this.props.estimatedHours;
  }

  rename(name: string): void {
    if (!name.trim()) {
      throw new Error('Name cannot be empty');
    }
    this.props.name = name;
  }

  updateDescription(description: string | null): void {
    this.props.description = description;
  }

  setStartDate(date: string | null): void {
    const previousStartDate = this.props.startDate;
    this.props.startDate = date;

    try {
      this.validateDates();
    } catch (error) {
      this.props.startDate = previousStartDate;
      throw error;
    }
  }

  changeProject(projectId: string): void {
    this.props.projectId = projectId;
  }

  setDueDate(date: string | null): void {
    const previousDueDate = this.props.dueDate;
    this.props.dueDate = date;

    try {
      this.validateDates();
    } catch (error) {
      this.props.dueDate = previousDueDate;
      throw error;
    }
  }

  setState(stateId: string | null): void {
    this.props.stateId = stateId;
  }
}
