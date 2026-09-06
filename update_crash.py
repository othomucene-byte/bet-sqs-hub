import sys

file_path = sys.argv[1]
with open(file_path, 'r') as f:
    content = f.read()

# Add autoRounds state
if 'const [autoPlay, setAutoPlay] =' in content:
    content = content.replace(
        'const [autoPlay, setAutoPlay] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false });',
        'const [autoPlay, setAutoPlay] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false });\n  const [autoRounds, setAutoRounds] = useState<Record<1 | 2, number>>({ 1: 10, 2: 10 });\n  const lastAttemptedRound = useRef<Record<1 | 2, string | null>>({ 1: null, 2: null });'
    )

# Add Autoplay Effect
autoplay_effect = """
  // Autoplay Logic: detect new BETTING round and place bet once.
  useEffect(() => {
    if (status !== "BETTING" || !round?.id) return;
    [1, 2].forEach((s) => {
      const slot = s as 1 | 2;
      if (!autoPlay[slot] || autoRounds[slot] <= 0) return;
      if (lastAttemptedRound.current[slot] === round.id) return;

      const hasBet = bets.some((b) => b.slot === slot);
      if (hasBet) return;

      lastAttemptedRound.current[slot] = round.id;
      placeMutation.mutate(
        { slot, amount: Number(amounts[slot]) || 0 },
        {
          onSuccess: (res) => {
            if (res.ok) {
              setAutoRounds((prev) => ({ ...prev, [slot]: prev[slot] - 1 }));
            } else {
              setAutoPlay((prev) => ({ ...prev, [slot]: false }));
            }
          },
          onError: () => setAutoPlay((prev) => ({ ...prev, [slot]: false })),
        }
      );
    });
  }, [status, round?.id, autoPlay, autoRounds, bets, amounts, placeMutation]);

  // Refresh wallet when round is settled (payouts processed)
  useEffect(() => {
    if (status === "SETTLED") {
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    }
  }, [status, queryClient]);
"""

if 'const countdown =' in content:
    content = content.replace('const countdown =', autoplay_effect + '\n  const countdown =')

# Update BetPad call
content = content.replace(
    'autoPlay={autoPlay[slot]}',
    'autoPlay={autoPlay[slot]}\n                autoPlayRounds={autoRounds[slot]}\n                onAutoPlayRounds={(next) => setAutoRounds((prev) => ({ ...prev, [slot]: next }))}'
)

with open(file_path, 'w') as f:
    f.write(content)
