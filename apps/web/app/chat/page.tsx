import { NovaHeader } from '@/components/layout/nova-header';
import { BottomNavigation } from '@/components/layout/bottom-navigation';
import ChatShell from '@/components/chat';

export default function ChatPage() {
  return (
    <>
      <NovaHeader backHref="/" />
      <ChatShell />
      <BottomNavigation />
    </>
  );
}
