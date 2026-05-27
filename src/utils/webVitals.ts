import { onCLS, onINP, onLCP } from 'web-vitals';

export function reportWebVitals() {
 onCLS((metric) => {
  console.log('CLS:', metric);
 });

 onINP((metric) => {
  console.log('INP:', metric);
 });

 onLCP((metric) => {
  console.log('LCP:', metric);
 });
}
