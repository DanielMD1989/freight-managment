/**
 * Toast Notification System
 *
 * Usage:
 * 1. Wrap your app with ToastProvider in layout.tsx
 * 2. Add ToastContainer to display toasts
 * 3. Use the useToast hook in any component:
 *
 * ```tsx
 * import { useToast } from '@/components/Toast';
 *
 * function MyComponent() {
 *   const toast = useToast();
 *
 *   const handleSuccess = () => {
 *     toast.success('Operation completed successfully!');
 *   };
 *
 *   const handleError = () => {
 *     toast.error('Something went wrong!');
 *   };
 *
 *   return <button onClick={handleSuccess}>Click me</button>;
 * }
 * ```
 */

export { ToastProvider, useToast } from './ToastContext';
export { default as ToastContainer } from './ToastContainer';
