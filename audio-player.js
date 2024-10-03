import { useRouter } from 'next/router';

export default function AudioPlayerPage() {
  const router = useRouter();
  const { audioUrl } = router.query;

  if (!audioUrl) {
    return <div>Audio URL is required.</div>;
  }

  return (
    <div>
      <h2>Audio Playback with Speed Adjustment</h2>
      <audio id="audio-player" controls>
        <source src={audioUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      <br /><br />
      <button onClick={() => changeSpeed(1.0)}>Normal (1x)</button>
      <button onClick={() => changeSpeed(0.9)}>0.90x</button>
      <button onClick={() => changeSpeed(0.8)}>0.80x</button>
      <button onClick={() => changeSpeed(0.7)}>0.70x</button>
      <button onClick={() => changeSpeed(0.6)}>0.60x</button>

      <script>
        function changeSpeed(speed) {
          var audioPlayer = document.getElementById('audio-player');
          audioPlayer.playbackRate = speed;
        }
      </script>
    </div>
  );
}
