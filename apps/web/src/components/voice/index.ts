// apps/web/src/components/voice/index.ts

// Export main component
export { VoiceRoomView } from './VoiceRoomView';
export { VoiceRoomList } from './VoiceRoomView';

// Export audio controls
export { AudioControls } from './AudioControls';
export { default as AudioControlsDefault } from './AudioControls';

// Export clap button
export { ClapButton } from './ClapButton';

// Export speaker queue
export { SpeakerQueue } from './SpeakerQueue';

// Export stage speaker
export { StageSpeaker } from './StageSpeaker';

// Export transcription display
export { TranscriptionDisplay } from './TranscriptionDisplay';

// Export voice call
export { VoiceCall } from './VoiceCall';

// Export shared components (you'll need to create these)
export { VoiceRoomHeader } from './shared/VoiceRoomHeader';
export { ConnectionHealth } from './shared/ConnectionHealth';
export { AudioLevelMeter } from './shared/AudioLevelMeter';
export { SectionPill } from './shared/SectionPill';
export { RoomQualityPanel } from './shared/RoomQualityPanel';
export { EmptyParticipantState } from './shared/EmptyParticipantState';
export { ShortcutPanel } from './shared/ShortcutPanel';
export { LeaveConfirmationModal } from './shared/LeaveConfirmationModal';
export { RoomDetailsPanel } from './shared/RoomDetailsPanel';
export { CommandCenter } from './shared/CommandCenter';
export { ActiveSpeakerStrip } from './shared/ActiveSpeakerStrip';
export { SessionInsights } from './shared/SessionInsights';

// Export chat components
export { ChatPanel } from './chat/ChatPanel';
export { MessageBubble } from './chat/MessageBubble';
export { DateSeparator } from './chat/DateSeparator';
export { MessageInput } from './chat/MessageInput';

// Export participant components
export { ParticipantGrid } from './participants/ParticipantGrid';
export { ParticipantCard } from './participants/ParticipantCard';

// Export theme and types
export { THEME } from './VoiceRoomView.theme';
export * from './VoiceRoomView.types';