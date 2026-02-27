/**
 * Organization Details Client Component
 * Sprint 1 - Story 1.4: Organization Management
 *
 * Client-side component for displaying and managing organization details
 */

"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
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
} from "lucide-react";

// Type definitions for organization details
interface OrganizationLoad {
  id: string;
  status: string;
}

interface OrganizationMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

interface OrganizationTruck {
  id: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  isVerified: boolean;
  contactEmail: string;
  contactPhone: string;
  address?: string | null;
  city?: string | null;
  licenseNumber?: string | null;
  taxId?: string | null;
  description?: string | null;
  users?: OrganizationMember[];
  trucks?: OrganizationTruck[];
  loads?: OrganizationLoad[];
}

interface SessionUser {
  userId: string;
  role: string;
  organizationId?: string | null;
}

interface OrganizationDetailsClientProps {
  organization: Organization;
  user: SessionUser;
}

export default function OrganizationDetailsClient({
  organization,
  user,
}: OrganizationDetailsClientProps) {
  const router = useRouter();

  const canEdit =
    user.role === "ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.organizationId === organization.id;

  const getOrganizationTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      SHIPPER: "Shipper",
      CARRIER_COMPANY: "Carrier (Company)",
      CARRIER_INDIVIDUAL: "Carrier (Individual)",
      LOGISTICS_AGENT: "Logistics Agent",
    };
    return types[type] || type;
  };

  const activeLoads =
    organization.loads?.filter(
      (load: OrganizationLoad) =>
        load.status !== "COMPLETED" && load.status !== "CANCELLED"
    ).length || 0;

  const completedLoads =
    organization.loads?.filter(
      (load: OrganizationLoad) => load.status === "COMPLETED"
    ).length || 0;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {organization.name}
          </h1>
          <p className="text-muted-foreground">
            {getOrganizationTypeLabel(organization.type)}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() =>
              router.push(`/organizations/${organization.id}/edit`)
            }
          >
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
            <CardDescription>
              Primary contact details for this organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-muted-foreground text-sm">
                  {organization.contactEmail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-muted-foreground text-sm">
                  {organization.contactPhone}
                </p>
              </div>
            </div>

            {organization.address && (
              <div className="flex items-center gap-3">
                <MapPin className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-muted-foreground text-sm">
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
            <CardDescription>
              Registration and licensing details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {organization.licenseNumber && (
              <div className="flex items-center gap-3">
                <FileText className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">License Number</p>
                  <p className="text-muted-foreground text-sm">
                    {organization.licenseNumber}
                  </p>
                </div>
              </div>
            )}

            {organization.taxId && (
              <div className="flex items-center gap-3">
                <FileText className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Tax ID</p>
                  <p className="text-muted-foreground text-sm">
                    {organization.taxId}
                  </p>
                </div>
              </div>
            )}

            {!organization.licenseNumber && !organization.taxId && (
              <p className="text-muted-foreground text-sm">
                No legal information provided
              </p>
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
              <Users className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Team Members</p>
                <p className="text-2xl font-bold">
                  {organization.users?.length || 0}
                </p>
              </div>
            </div>

            {organization.type.startsWith("CARRIER") && (
              <div className="flex items-center gap-3">
                <Truck className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Trucks</p>
                  <p className="text-2xl font-bold">
                    {organization.trucks?.length || 0}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Package className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-sm font-medium">
                  {organization.type === "SHIPPER"
                    ? "Posted Loads"
                    : "Completed Loads"}
                </p>
                <p className="text-2xl font-bold">{completedLoads}</p>
              </div>
            </div>

            {activeLoads > 0 && (
              <div className="flex items-center gap-3">
                <Package className="text-muted-foreground h-4 w-4" />
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
              <p className="text-muted-foreground text-sm">
                {organization.description}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Team Members */}
      {organization.users && organization.users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Users belonging to this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {organization.users.map((member: OrganizationMember) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {member.email}
                    </p>
                  </div>
                  <Badge variant="secondary">{member.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
