import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ColorWizard - ThreeJS Live Blueprint',
  description: 'Realtime color quantization preview with Three.js',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
