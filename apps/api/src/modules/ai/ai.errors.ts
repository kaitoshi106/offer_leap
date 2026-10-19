/** The provider could not be reached or every model was busy. Temporary: the caller may retry later. */
export class AiUnavailableError extends Error {
  override readonly name = 'AiUnavailableError';
}

/** The model answered, but not with usable JSON. Retrying the same input rarely helps. */
export class AiInvalidOutputError extends Error {
  override readonly name = 'AiInvalidOutputError';
}
