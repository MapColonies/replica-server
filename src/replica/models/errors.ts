export class ReplicaNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ReplicaNotFoundError.prototype);
  }
}

export class ReplicaAlreadyExistsError extends Error {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ReplicaAlreadyExistsError.prototype);
  }
}
