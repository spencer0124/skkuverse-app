/** The embed build inlines each PNG as a data URL (esbuild `dataurl` loader). */
declare module '*.png' {
  const url: string;
  export default url;
}
