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

  /** Get team members */
  async getMembers(orgId: string): Promise<
    Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      status: string;
    }>
  > {
    try {
      const response = await apiClient.get(`/api/organizations/${orgId}`);
      const org = response.data.organization ?? response.data;
      return org.users ?? [];
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get pending invitations (GET /api/organizations/invitations — flat, no orgId in path) */
  async getInvitations(
    _orgId: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<
    Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      createdAt: string;
    }>
  > {
    try {
      const response = await apiClient.get(`/api/organizations/invitations`);
      return response.data.invitations ?? response.data ?? [];
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Invite a team member (POST /api/organizations/invitations — organizationId in body) */
  async inviteMember(
    orgId: string,
    data: { email: string; role: string }
  ): Promise<unknown> {
    try {
      const response = await apiClient.post(`/api/organizations/invitations`, {
        ...data,
        organizationId: orgId,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Remove a team member (DELETE /api/organizations/members/:userId — no orgId in path) */
  async removeMember(_orgId: string, userId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/organizations/members/${userId}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Cancel invitation (DELETE /api/organizations/invitations/:invitationId — no orgId in path) */
  async cancelInvitation(_orgId: string, invitationId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/organizations/invitations/${invitationId}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const organizationService = new OrganizationService();
