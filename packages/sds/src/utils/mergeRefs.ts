import type { MutableRefObject, Ref, RefCallback } from 'react';

type PossibleRef<T> = Ref<T> | undefined;

export function mergeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  return (instance: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(instance);
      } else if (ref != null) {
        (ref as MutableRefObject<T | null>).current = instance;
      }
    });
  };
}
