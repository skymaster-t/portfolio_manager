// src/types/react.d.ts
/// <reference types="react" />
/// <reference types="react-dom" />

declare global {
    namespace JSX {
      interface IntrinsicElements {
        [elem: string]: any;
      }
    }
  }