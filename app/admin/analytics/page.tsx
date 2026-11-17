import type { Metadata } from 'next'
import AdminAnalyticsDashboard from '@/components/admin-analytics-dashboard'

export const metadata: Metadata = {
  title: 'Store Analytics & Orders | Nexus Gadgets',
  description: 'Review product views, delivered sales, and customer orders for Nexus Gadgets.',
}

export default function AnalyticsPage() {
  return <AdminAnalyticsDashboard />
}
