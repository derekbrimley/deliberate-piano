/**
 * Plays a pleasant ding sound using Web Audio API
 */
export const playDingSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create oscillator for the main tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set a pleasant bell-like frequency (E6 note)
    oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime);

    // Create an envelope for a bell-like sound
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    // Use a sine wave for a pure tone
    oscillator.type = 'sine';

    // Play the sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Clean up
    oscillator.onended = () => {
      audioContext.close();
    };
  } catch (error) {
    console.error('Failed to play ding sound:', error);
  }
};
