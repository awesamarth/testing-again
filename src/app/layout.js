import "./globals.css";
import { ContextProvider } from '@/context'
import Footer from "./components/Footer";

export const metadata = {
  title: "Test Mega",
  description: "Test mega",
  icons: {
    icon: 'img/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
      <ContextProvider><Footer/>{children}</ContextProvider>
      </body>
    </html>
  );
}
