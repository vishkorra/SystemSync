'use client'

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Check, Crown } from "lucide-react"
import { TierLimit } from "@/types"
import { formatBytes } from "@/lib/utils"

const tiers: Record<string, TierLimit> = {
  Free: {
    maxBackupSize: 1024 * 1024 * 500, // 500MB
    maxApps: 3,
    retentionDays: 7,
    features: [
      'Basic application backup',
      'Essential settings sync',
      '7-day backup retention',
      'Up to 3 applications'
    ]
  },
  Pro: {
    maxBackupSize: 1024 * 1024 * 1024 * 5, // 5GB
    maxApps: 10,
    retentionDays: 30,
    features: [
      'Advanced application backup',
      'Complete settings sync',
      '30-day backup retention',
      'Up to 10 applications',
      'Priority support',
      'Cloud storage integration'
    ]
  },
  Premium: {
    maxBackupSize: 1024 * 1024 * 1024 * 20, // 20GB
    maxApps: -1, // unlimited
    retentionDays: 90,
    features: [
      'Enterprise-grade backup',
      'Unlimited applications',
      '90-day backup retention',
      'Advanced encryption',
      'Custom backup schedules',
      'Priority 24/7 support',
      'Multi-device sync',
      'Team collaboration'
    ]
  }
}

interface TierSelectionProps {
  currentTier: string
  onSelect: (tier: string) => void
}

export function TierSelection({ currentTier, onSelect }: TierSelectionProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {Object.entries(tiers).map(([tier, limits]) => (
        <Card key={tier} className={currentTier === tier ? 'border-primary' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {tier}
              {tier === 'Premium' && <Crown className="h-5 w-5 text-yellow-500" />}
            </CardTitle>
            <CardDescription>
              {tier === 'Free' ? 'Get started with basic features' :
               tier === 'Pro' ? 'Perfect for power users' :
               'Ultimate backup solution'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {tier === 'Free' ? 'Free' :
                 tier === 'Pro' ? '$9.99/mo' :
                 '$24.99/mo'}
              </p>
              <ul className="space-y-2 mt-4">
                {limits.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant={currentTier === tier ? "outline" : "default"}
              onClick={() => onSelect(tier)}
            >
              {currentTier === tier ? 'Current Plan' : 'Upgrade'}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
} 