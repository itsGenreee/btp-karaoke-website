import { useState } from 'react'
import { useSession } from '../../lib/auth-client'
import { formatPhoneNumber } from '../../lib/booking-format'
import AccountTab from './components/profile/AccountTab'
import ProfileTabs from './components/profile/ProfileTabs'
import PublicProfileTab from './components/profile/PublicProfileTab'
import type { ProfileIdentity } from './components/profile/types'

export default function ProfilePage() {
  const [tab, setTab] = useState<'account' | 'profile'>('account')
  const { data, refetch } = useSession()

  const user = data?.user
  const identity: ProfileIdentity = {
    image: user?.image,
    fullName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || 'Your Name',
    email: user?.email ?? '',
    emailVerified: user?.emailVerified ?? false,
    phone: user?.contact_num ? formatPhoneNumber(user.contact_num) : 'Not set',
    phoneVerified: (user as any)?.contact_verified ?? false,
    handle: user?.email ? `@${user.email.split('@')[0]}` : '@your_handle',
    memberSince: user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : '',
    location: {
      province: user?.province ?? '',
      cityMunicipality: user?.city_municipality ?? '',
      barangay: user?.barangay ?? '',
    },
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ProfileTabs tab={tab} onTabChange={setTab} />
      {tab === 'account' ? (
        <AccountTab
          identity={identity}
          onLocationSaved={() => refetch()}
          onImageSaved={() => refetch()}
          onPhoneVerified={() => refetch()}
        />
      ) : (
        <PublicProfileTab />
      )}
    </div>
  )
}
