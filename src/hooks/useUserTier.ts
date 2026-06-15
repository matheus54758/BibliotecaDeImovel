import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type UserTier = 'free' | 'paid';

export interface TierLimits {
  builders: number;
  developments: number;
}

const LIMITS: Record<UserTier, TierLimits> = {
  free: {
    builders: 2,
    developments: 5,
  },
  paid: {
    builders: Infinity,
    developments: Infinity,
  },
};

export const useUserTier = () => {
  const [tier, setTier] = useState<UserTier>('free');
  const [subscriptionDates, setSubscriptionDates] = useState<{ start?: string; end?: string }>({});
  const [counts, setCounts] = useState({ builders: 0, developments: 0 });
  const [loading, setLoading] = useState(true);

  const fetchTierAndCounts = async () => {
    try {
      // Use getUser(token) to bypass cache and get fresh metadata from server
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 1. Get tier from user_metadata
      const metadata = { ...user.app_metadata, ...user.user_metadata };
      const userTier = (metadata.tier as UserTier) || 'free';
      setTier(userTier);

      if (userTier === 'paid') {
        setSubscriptionDates({
          start: metadata.subscription_start as string,
          end: metadata.subscription_end as string,
        });
      }

      // 2. Get current counts
      const [buildersRes, developmentsRes] = await Promise.all([
        supabase
          .from('builders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('developments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('parent_id', null),
      ]);

      setCounts({
        builders: buildersRes.count || 0,
        developments: developmentsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching tier info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTierAndCounts();
  }, []);

  const limits = LIMITS[tier];
  
  const canAddBuilder = counts.builders < limits.builders;
  const canAddDevelopment = counts.developments < limits.developments;

  return {
    tier,
    subscriptionDates,
    limits,
    counts,
    loading,
    canAddBuilder,
    canAddDevelopment,
    refresh: fetchTierAndCounts
  };
};
