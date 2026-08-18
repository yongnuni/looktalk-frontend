import { useEffect } from 'react';
import { getStaffMe } from '../api/staffProfile';
import { useStaffProfileStore } from '../../../shared/stores/staffProfileStore';

/**
 * 의료진 본인 정보 조회 (STAFF-001).
 * store를 공유하므로 "내 정보 수정"에서 이름을 바꾸면 같은 세션의
 * 다른 화면(의료진 채팅 헤더 등)에도 즉시 반영된다.
 */
export function useStaffProfile() {
  const name = useStaffProfileStore((state) => state.name);
  const email = useStaffProfileStore((state) => state.email);
  const hospitalName = useStaffProfileStore((state) => state.hospitalName);
  const roleLabel = useStaffProfileStore((state) => state.roleLabel);
  const setProfile = useStaffProfileStore((state) => state.setProfile);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const me = await getStaffMe();

        if (!isMounted) return;

        setProfile({
          name: me.name ?? me.displayName,
          email: me.email,
          hospitalName: me.hospital.hospitalName,
        });
      } catch (error) {
        console.error('의료진 정보 조회 실패:', error);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [setProfile]);

  return { name, email, hospitalName, roleLabel, setProfile };
}
