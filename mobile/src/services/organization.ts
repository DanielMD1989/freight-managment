/**
 * Organization Service - API calls for organization/company profile
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface OrganizationDetail {
  id: string;
  name: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  licenseNumber: string | null;
  taxId: string | null;
  allowNameDisplay: boolean;
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }>;
  _count?: {
    trucks: number;
    loads: number;
    disputesAgainst: number;
  };
}

export interface UpdateOrganizationData {
  name?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  licenseNumber?: string;
  taxId?: string;
  allowNameDisplay?: boolean;
}

class OrganizationService {
  /** Get organization by ID */
  async getOrganization(id: string): Promise<OrganizationDetail> {
    try {
      const response = await apiClient.get(`/api/organizations/${id}`);
      return response.data.organization ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Update organization */
  async updateOrganization(
    id: string,
    data: UpdateOrganizationData
  ): Promise<OrganizationDetail> {
    try {
      const response = await apiClient.patch(`/api/organizations/${id}`, data);
      return response.data.organization ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const organizationService = new OrganizationService();
