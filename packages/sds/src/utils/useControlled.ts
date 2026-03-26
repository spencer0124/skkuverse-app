/**
 * Hook for controlled/uncontrolled component pattern.
 * If controlledValue is provided, it takes precedence.
 */
import { useCallback, useRef, useState } from 'react';

interface UseControlledOptions<T> {
  controlledValue?: T;
  defaultValue: T;
}

export function useControlled<T>({
  controlledValue,
  defaultValue,
}: UseControlledOptions<T>): [T, (value: T) => void] {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;

  const value = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setInternalValue(next);
      }
    },
    [isControlled],
  );

  return [value, setValue];
}
