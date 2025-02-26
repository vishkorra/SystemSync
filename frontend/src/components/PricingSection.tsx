'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import Link from 'next/link'

type PricingTier = {
  name: string
  description: string
  price: {
    monthly: string
    yearly: string
  }
  features: string[]
  cta: string
  popular?: boolean
}

const pricingTiers: PricingTier[] = [
  {
    name: "Free",
    description: "Perfect for individual users",
    price: {
      monthly: "$0",
      yearly: "$0"
    },
    features: [
      "3 application backups",
      "Basic settings sync",
      "Manual backup",
      "Community support"
    ],
    cta: "Get Started"
  },
  {
    name: "Pro",
    description: "For power users",
    price: {
      monthly: "$9",
      yearly: "$90"
    },
    features: [
      "Unlimited application backups",
      "Advanced settings sync",
      "Automatic scheduled backups",
      "Application packaging",
      "Priority support"
    ],
    cta: "Start Free Trial",
    popular: true
  },
  {
    name: "Team",
    description: "For teams and businesses",
    price: {
      monthly: "$19",
      yearly: "$190"
    },
    features: [
      "Everything in Pro",
      "Team management",
      "Shared settings templates",
      "Admin controls",
      "Team backup history",
      "Dedicated support"
    ],
    cta: "Contact Sales"
  }
]

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <section id="pricing" className="w-full py-12 md:py-24 lg:py-32">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-blue-100 px-3 py-1 text-sm dark:bg-blue-800/30">
              Pricing
            </div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Simple, Transparent Pricing</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              Choose the plan that's right for you and start syncing your application settings today.
            </p>
          </div>
          
          <div className="flex items-center space-x-4 mt-6">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                billingCycle === 'monthly'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-800/30 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                billingCycle === 'yearly'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-800/30 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50'
              }`}
            >
              Yearly <span className="text-xs text-green-500 ml-1">Save 20%</span>
            </button>
          </div>
        </div>
        
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 mt-12">
          {pricingTiers.map((tier, index) => (
            <div 
              key={index}
              className={`flex flex-col rounded-xl border p-6 ${
                tier.popular 
                  ? 'border-blue-600 dark:border-blue-400 shadow-lg' 
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-0 right-0 mx-auto w-fit rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                  Most Popular
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-xl font-bold">{tier.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {tier.description}
                </p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold">
                    {billingCycle === 'monthly' ? tier.price.monthly : tier.price.yearly}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingCycle === 'yearly' && tier.name !== 'Free' && (
                  <p className="text-xs text-green-500 mt-1">Save 20% with annual billing</p>
                )}
              </div>
              <ul className="mb-6 space-y-2 flex-1">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/dashboard">
                <Button 
                  className={`w-full ${
                    tier.popular 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-50'
                  }`}
                >
                  {tier.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </section>
  )
} 