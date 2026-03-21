import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f0f1a',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://xn--80aaaqjgddaqi2bmfw7b.xn--p1ai'),
  title: 'Экспериментальная платформа изучения поведения нейросетей',
  description: 'Открытое исследование в области взаимодействия человека с искусственным интеллектом. Присоединяйтесь к эксперименту.',
  openGraph: {
    title: 'Экспериментальная платформа изучения поведения нейросетей',
    description: 'Открытое исследование в области взаимодействия человека с искусственным интеллектом. Присоединяйтесь к эксперименту.',
    type: 'website',
    locale: 'ru_RU',
    siteName: 'AI Research',
    images: [{ url: '/ogimage.jpg', width: 1280, height: 720 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Экспериментальная платформа изучения поведения нейросетей',
    description: 'Открытое исследование в области взаимодействия человека с ИИ. Присоединяйтесь.',
    images: ['/ogimage.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        {children}
        <Script id="yandex-metrika" strategy="afterInteractive">{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=108182887','ym');
          ym(108182887,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
        <noscript>
          <div><img src="https://mc.yandex.ru/watch/108182887" style={{position:'absolute',left:'-9999px'}} alt="" /></div>
        </noscript>
      </body>
    </html>
  );
}
