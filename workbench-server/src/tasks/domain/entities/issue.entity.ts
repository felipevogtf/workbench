import { DomainError } from '@core/domain/domain.error';
import { IssueProps } from './issue.props';

export const ISSUE_PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];

export class Issue {
  private constructor(private props: IssueProps) {
    this.validateIdentity();
    this.validateDates();
    this.validateEstimatedHours();
  }

  static createLocal(
    data: Pick<
      IssueProps,
      'name' | 'projectId' | 'description' | 'localSequence'
    >,
  ): Issue {
    return new Issue({
      ...data,
      id: crypto.randomUUID(),
      isLocal: true,
      externalId: null,
      remoteSequence: null,
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
      | 'remoteSequence'
      | 'startDate'
      | 'dueDate'
    > & { estimatedHours?: number | null },
  ): void {
    this.props.name = data.name;
    this.props.description = data.description;
    this.props.externalState = data.externalState;
    this.props.priority = data.priority;
    this.props.remoteSequence = data.remoteSequence;
    this.props.startDate = data.startDate;
    this.props.dueDate = data.dueDate;
    // Plane manda cuando tiene estimado; si no, se conserva el que se haya puesto aquí.
    if (data.estimatedHours !== undefined && data.estimatedHours !== null) {
      this.props.estimatedHours = data.estimatedHours;
    }
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
      throw new DomainError('Local issue cannot have an externalId');
    }

    if (!this.props.isLocal && this.props.externalId === null) {
      throw new DomainError('Non-local issue must have an externalId');
    }
  }

  private validateDates() {
    const { startDate, dueDate } = this.props;
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      throw new DomainError('Start date cannot be after due date');
    }
  }

  private validateEstimatedHours() {
    const { estimatedHours } = this.props;
    if (estimatedHours !== null && estimatedHours < 0) {
      throw new DomainError('Estimated hours cannot be negative');
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

  get remoteSequence(): number | null {
    return this.props.remoteSequence;
  }

  get localSequence(): number {
    return this.props.localSequence;
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
    this.assertLocal('name');
    if (!name.trim()) {
      throw new DomainError('Name cannot be empty');
    }
    this.props.name = name;
  }

  updateDescription(description: string | null): void {
    this.assertLocal('description');
    this.props.description = description;
  }

  changeProject(projectId: string): void {
    this.assertLocal('project');
    this.props.projectId = projectId;
  }

  setPriority(priority: string | null): void {
    this.assertLocal('priority');
    if (priority !== null && !ISSUE_PRIORITIES.includes(priority)) {
      throw new DomainError(
        `Priority must be one of: ${ISSUE_PRIORITIES.join(', ')}`,
      );
    }
    this.props.priority = priority;
  }

  // Cambia las fechas juntas: validarlas una a una rechazaría rangos válidos
  // (por ejemplo, mover inicio y vencimiento a un período posterior).
  setDates(dates: {
    startDate?: string | null;
    dueDate?: string | null;
  }): void {
    this.assertLocal('dates');
    const startDate =
      dates.startDate === undefined ? this.props.startDate : dates.startDate;
    const dueDate =
      dates.dueDate === undefined ? this.props.dueDate : dates.dueDate;
    for (const date of [startDate, dueDate]) {
      if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new DomainError('Dates must use the YYYY-MM-DD format');
      }
    }

    const previous = { start: this.props.startDate, due: this.props.dueDate };
    this.props.startDate = startDate;
    this.props.dueDate = dueDate;
    try {
      this.validateDates();
    } catch (error) {
      this.props.startDate = previous.start;
      this.props.dueDate = previous.due;
      throw error;
    }
  }

  // Las horas estimadas, las etiquetas y el estado no vienen de Plane, así
  // que se pueden editar en cualquier tarea.
  setEstimatedHours(hours: number | null): void {
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      throw new DomainError('Estimated hours must be a number of 0 or more');
    }
    this.props.estimatedHours = hours;
  }

  setLabels(labelIds: string[]): void {
    this.props.labelIds = [...new Set(labelIds)];
  }

  setState(stateId: string | null): void {
    this.props.stateId = stateId;
  }

  // El sync con Plane sobrescribe estos campos: editarlos aquí se perdería
  // en la siguiente sincronización.
  private assertLocal(field: string): void {
    if (!this.props.isLocal) {
      throw new DomainError(
        `The ${field} of a Plane issue is managed in Plane and cannot be edited here`,
      );
    }
  }
}
