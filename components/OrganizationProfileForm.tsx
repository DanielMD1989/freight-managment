/**
 * Organization Profile Form
 * Sprint 1 - Story 1.4: Organization Management
 *
 * Form for creating and editing organization profiles
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Save, Loader2 } from 'lucide-react';

interface OrganizationFormData {
  name: string;
  type: string;
  description?: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  city?: string;
  licenseNumber?: string;
  taxId?: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  description?: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  city?: string;
  licenseNumber?: string;
  taxId?: string;
}

interface OrganizationProfileFormProps {
  organization?: Organization;
  mode?: 'create' | 'edit';
  onSuccess?: () => void;
}

export default function OrganizationProfileForm({
  organization,
  mode = 'create',
  onSuccess,
}: OrganizationProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OrganizationFormData>({
    name: organization?.name || '',
    type: organization?.type || 'SHIPPER',
    description: organization?.description || '',
    contactEmail: organization?.contactEmail || '',
    contactPhone: organization?.contactPhone || '',
    address: organization?.address || '',
    city: organization?.city || '',
    licenseNumber: organization?.licenseNumber || '',
    taxId: organization?.taxId || '',
  });

  const handleChange = (field: keyof OrganizationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = mode === 'create'
        ? '/api/organizations'
        : `/api/organizations/${organization?.id}`;

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save organization');
      }

      const data = await response.json();

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/organizations/${data.organization.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {mode === 'create' ? 'Create Organization' : 'Edit Organization'}
        </CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'Set up your organization profile to start using the platform'
            : 'Update your organization information'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Organization Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Acme Logistics"
              required
            />
          </div>

          {/* Organization Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              Organization Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHIPPER">Shipper</SelectItem>
                <SelectItem value="CARRIER_COMPANY">Carrier (Company)</SelectItem>
                <SelectItem value="CARRIER_INDIVIDUAL">Carrier (Individual)</SelectItem>
                <SelectItem value="LOGISTICS_AGENT">Logistics Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of your organization"
              rows={3}
            />
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">
                Contact Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="contact@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">
                Contact Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                placeholder="+251-XXX-XXX-XXX"
                required
              />
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Street address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="City name"
            />
          </div>

          {/* Legal Information */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                value={formData.licenseNumber}
                onChange={(e) => handleChange('licenseNumber', e.target.value)}
                placeholder="Business license number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / TIN</Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) => handleChange('taxId', e.target.value)}
                placeholder="Tax identification number"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {mode === 'create' ? 'Create Organization' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
