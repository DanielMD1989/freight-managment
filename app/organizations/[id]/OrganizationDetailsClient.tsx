/**
 * Organization Details Client Component
 * Sprint 1 - Story 1.4: Organization Management
 *
 * Client-side component for displaying and managing organization details
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Users,
  Truck,
  Package,
  Edit,
  Check,
  X,
} from 'lucide-react';

interface OrganizationDetailsClientProps {
  organization: any;
  user: any;
}

export default function OrganizationDetailsClient({
  organization,
  user,
}: OrganizationDetailsClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const canEdit =
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.organizationId === organization.id;

  const getOrganizationTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      SHIPPER: 'Shipper',
      CARRIER_COMPANY: 'Carrier (Company)',
      CARRIER_INDIVIDUAL: 'Carrier (Individual)',
      LOGISTICS_AGENT: 'Logistics Agent',
    };
    return types[type] || type;
  };

  const activeLoads = organization.loads?.filter(
    (load: any) => load.status !== 'COMPLETED' && load.status !== 'CANCELLED'
  ).length || 0;

  const completedLoads = organization.loads?.filter(
    (load: any) => load.status === 'COMPLETED'
  ).length || 0;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
          <p className="text-muted-foreground">
            {getOrganizationTypeLabel(organization.type)}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => router.push(`/organizations/${organization.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Organization
          </Button>
        )}
      </div>

      {/* Verification Badge */}
      {organization.isVerified ? (
        <Badge className="bg-green-600">
          <Check className="mr-1 h-3 w-3" />
          Verified Organization
        </Badge>
      ) : (
        <Badge variant="secondary">
          <X className="mr-1 h-3 w-3" />
          Not Verified
        </Badge>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Primary contact details for this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{organization.contactEmail}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{organization.contactPhone}</p>
              </div>
            </div>

            {organization.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">
                    {organization.address}
                    {organization.city && `, ${organization.city}`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Legal Information</CardTitle>
            <CardDescription>Registration and licensing details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {organization.licenseNumber && (
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">License Number</p>
                  <p className="text-sm text-muted-foreground">{organization.licenseNumber}</p>
                </div>
              </div>
            )}

            {organization.taxId && (
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Tax ID</p>
                  <p className="text-sm text-muted-foreground">{organization.taxId}</p>
                </div>
              </div>
            )}

            {!organization.licenseNumber && !organization.taxId && (
              <p className="text-sm text-muted-foreground">No legal information provided</p>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Organization activity overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Team Members</p>
                <p className="text-2xl font-bold">{organization.users?.length || 0}</p>
              </div>
            </div>

            {organization.type.startsWith('CARRIER') && (
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Trucks</p>
                  <p className="text-2xl font-bold">{organization.trucks?.length || 0}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {organization.type === 'SHIPPER' ? 'Posted Loads' : 'Completed Loads'}
                </p>
                <p className="text-2xl font-bold">{completedLoads}</p>
              </div>
            </div>

            {activeLoads > 0 && (
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Active Loads</p>
                  <p className="text-2xl font-bold">{activeLoads}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        {organization.description && (
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{organization.description}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Team Members */}
      {organization.users && organization.users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Users belonging to this organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {organization.users.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="secondary">{user.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
