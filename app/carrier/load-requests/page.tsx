/**
 * Redirect to combined requests page
 *
 * The load-requests page has been merged into /carrier/requests
 */

import { redirect } from 'next/navigation';

export default function CarrierLoadRequestsRedirect() {
  redirect('/carrier/requests?tab=my-requests');
}
