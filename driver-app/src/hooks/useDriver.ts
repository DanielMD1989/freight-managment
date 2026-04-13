/**
 * Driver profile hooks
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { driverService } from "../services/driver";

const PROFILE_KEY = ["driver-profile"] as const;

export function useMyProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => driverService.getMyProfile(),
  });
}

export function useToggleAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      driverId,
      isAvailable,
    }: {
      driverId: string;
      isAvailable: boolean;
    }) => driverService.updateAvailability(driverId, isAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}

export function useUpdateDriverProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      driverId,
      data,
    }: {
      driverId: string;
      data: Record<string, unknown>;
    }) => driverService.updateProfile(driverId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}

export function useUploadCdlPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      driverId,
      fieldName,
      uri,
      fileName,
      mimeType,
    }: {
      driverId: string;
      fieldName: "cdlFront" | "cdlBack" | "medicalCert";
      uri: string;
      fileName: string;
      mimeType: string;
    }) =>
      driverService.uploadCdlPhoto(
        driverId,
        fieldName,
        uri,
        fileName,
        mimeType
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}
