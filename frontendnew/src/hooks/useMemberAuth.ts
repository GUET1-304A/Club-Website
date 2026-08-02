import { useState, useEffect, useCallback } from 'react'
import {
  isMemberLoggedIn,
  memberGetMe,
  memberLogin,
  memberLogout,
  clearMemberToken,
  getCachedProfile,
  type MemberProfile,
} from '../services/memberApi'

interface MemberAuthState {
  /** True while the initial auth check is in progress */
  loading: boolean
  /** The authenticated member, or null if not logged in */
  member: MemberProfile | null
  /** Update the cached member profile (after editing) */
  setMember: (m: MemberProfile) => void
  /** Login with student_id/email + password. Throws on failure. */
  login: (account: string, password: string) => Promise<MemberProfile>
  /** Log out and clear stored token */
  logout: () => void
  /** Refresh the member profile from the server */
  refresh: () => Promise<void>
}

export function useMemberAuth(): MemberAuthState {
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<MemberProfile | null>(getCachedProfile)

  // On mount: verify stored token with server
  useEffect(() => {
    if (!isMemberLoggedIn()) {
      setLoading(false)
      return
    }

    memberGetMe()
      .then(profile => {
        setMember(profile)
      })
      .catch(() => {
        // Token invalid — clear it
        clearMemberToken()
        setMember(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (account: string, password: string): Promise<MemberProfile> => {
    const { member: profile } = await memberLogin(account, password)
    setMember(profile)
    return profile
  }, [])

  const logout = useCallback(() => {
    memberLogout()
    setMember(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const profile = await memberGetMe()
      setMember(profile)
    } catch {
      // keep current member state on refresh failure
    }
  }, [])

  const updateMember = useCallback((m: MemberProfile) => {
    setMember(m)
  }, [])

  return { loading, member, setMember: updateMember, login, logout, refresh }
}
