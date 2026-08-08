import { FlatCompat } from '@eslint/eslintrc';
import { globalIgnores } from 'eslint/config';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [...compat.extends('next/core-web-vitals', 'next/typescript')];
const finalConfig = [
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts']),
  ...config,
];

export default finalConfig;
