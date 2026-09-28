/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer's pdfkit dependency loads its built-in font data files
  // (Helvetica etc.) via dynamic require() calls Vercel's build tracer can't
  // statically detect, so without this they're silently left out of the
  // deployed serverless function and PDF generation fails at runtime with
  // "Cannot find module .../standard-fonts/Helvetica.cjs".
  experimental: {
    outputFileTracingIncludes: {
      "/api/**": [
        "./node_modules/@react-pdf/pdfkit/**/*",
        "./node_modules/pdfkit/**/*",
        "./node_modules/fontkit/**/*",
      ],
    },
  },
};

export default nextConfig;
