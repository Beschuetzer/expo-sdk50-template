import reducer, {
  errorSelector,
  resetErrors,
  setError,
  setErrors,
} from './generalSlice';

describe('generalSlice', () => {
  it('adds an error even when the current errors list is undefined', () => {
    const nextState = reducer(
      { errors: undefined } as any,
      setError({
        message: 'Demo error',
        name: 'DemoError',
      }),
    );

    expect(nextState.errors).toHaveLength(1);
    expect(nextState.errors[0].message).toBe('Demo error');
  });

  it('uses fallback values for missing error metadata', () => {
    const nextState = reducer(
      { errors: [] },
      setError({ statusCode: 404 } as any),
    );

    expect(nextState.errors).toEqual([
      {
        message: 'Unknown error',
        statusCode: 404,
        stack: undefined,
        name: undefined,
        code: undefined,
        error: undefined,
      },
    ]);
  });

  it('normalizes invalid setError payloads to the fallback message', () => {
    const nextState = reducer(
      { errors: [{ message: 'Existing error' }] },
      setError({ message: '   ' } as any),
    );

    expect(nextState.errors).toEqual([
      { message: 'Existing error' },
      {
        message: 'Unknown error',
        statusCode: undefined,
        stack: undefined,
        name: undefined,
        code: undefined,
        error: undefined,
      },
    ]);
  });

  it('ignores missing setError payloads and handles missing setErrors state', () => {
    const unchangedState = reducer(
      { errors: [{ message: 'Existing error' }] },
      setError(null as any),
    );
    expect(unchangedState.errors).toEqual([{ message: 'Existing error' }]);

    const resetState = reducer(
      { errors: undefined } as any,
      setErrors(null as any),
    );
    expect(resetState.errors).toEqual([]);
  });

  it('resets errors back to the initial empty list', () => {
    const nextState = reducer(
      { errors: [{ message: 'Previous issue' }] },
      resetErrors(),
    );

    expect(nextState.errors).toEqual([]);
  });

  it('normalizes nested error metadata and keeps fallback errors', () => {
    const nextState = reducer(
      { errors: [] },
      setErrors([
        {
          message: 'Root message',
          statusCode: 418,
          stack: 'stack',
          name: 'RootError',
          code: 'ERR_ROOT',
          error: {
            message: 'Nested message',
            stack: 'nested-stack',
            name: 'NestedError',
            code: 123,
          },
        },
        null,
        { message: '   ' },
      ] as any),
    );

    expect(nextState.errors).toEqual([
      {
        message: 'Root message',
        statusCode: 418,
        stack: 'stack',
        name: 'RootError',
        code: 'ERR_ROOT',
        error: {
          message: 'Nested message',
          stack: 'nested-stack',
          name: 'NestedError',
          code: 123,
        },
      },
      {
        message: 'Unknown error',
        statusCode: undefined,
        stack: undefined,
        name: undefined,
        code: undefined,
        error: undefined,
      },
    ]);
  });

  it('resets only when every setErrors value is a non-object or empty value', () => {
    const nextState = reducer(
      { errors: [{ message: 'Old error' }] },
      setErrors([null, undefined, 0] as any),
    );

    expect(nextState.errors).toEqual([]);
  });

  it('preserves prior errors when appending new valid ones', () => {
    const nextState = reducer(
      { errors: [{ message: 'Existing error' }] },
      setErrors([{ message: 'Appended error' }]),
    );

    expect(nextState.errors).toEqual([
      { message: 'Existing error' },
      { message: 'Appended error' },
    ]);
  });

  it('selects the error list from the general slice', () => {
    const state = {
      general: { errors: [{ message: 'Selected error' }] },
    } as any;

    expect(errorSelector(state)).toEqual([{ message: 'Selected error' }]);
  });

  it('keeps prior errors and appends the normalized fallback when invalid entries are provided', () => {
    const nextState = reducer(
      { errors: [{ message: 'Existing error' }] },
      setErrors([{} as any, '', null, undefined] as any),
    );

    expect(nextState.errors).toEqual([
      { message: 'Existing error' },
      {
        message: 'Unknown error',
        statusCode: undefined,
        stack: undefined,
        name: undefined,
        code: undefined,
        error: undefined,
      },
    ]);
  });

  it('normalizes nested error objects even when their metadata is invalid', () => {
    const nextState = reducer(
      { errors: [] },
      setErrors([
        {
          message: 'Outer message',
          statusCode: 500,
          name: 'OuterError',
          code: 'OUTER',
          error: {
            message: 123,
            stack: false,
            name: null,
            code: true,
          },
        },
      ] as any),
    );

    expect(nextState.errors).toEqual([
      {
        message: 'Outer message',
        statusCode: 500,
        stack: undefined,
        name: 'OuterError',
        code: 'OUTER',
        error: {
          message: undefined,
          stack: undefined,
          name: undefined,
          code: undefined,
        },
      },
    ]);
  });
});
