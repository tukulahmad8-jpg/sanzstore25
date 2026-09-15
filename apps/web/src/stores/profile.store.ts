import { create } from 'zustand'
import type { CustomerProfile } from '@/types/domain'

interface ProfileState {
  profile: CustomerProfile
  setProfile: (profile: CustomerProfile) => void
}

function hydrate(): CustomerProfile {
  try {
    return JSON.parse(localStorage.getItem('sanz-profile') ?? '{}') as CustomerProfile
  } catch {
    return {}
  }
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: hydrate(),
  setProfile: (profile) => {
    localStorage.setItem('sanz-profile', JSON.stringify(profile))
    set({ profile })
  },
}))
