import sys
import re

file_path = "src/components/games/bet-pad.tsx"
with open(file_path, 'r') as f:
    content = f.read()

# Update props interface
content = content.replace(
    'autoPlay?: boolean;',
    'autoPlay?: boolean;\n  autoPlayRounds?: number;\n  onAutoPlayRounds?: (next: number) => void;'
)

# Update function signature
content = content.replace(
    'autoPlay,',
    'autoPlay,\n  autoPlayRounds,\n  onAutoPlayRounds,'
)

# Add rounds input in the UI
# I'll put it inside the autoPlay button or next to it.
# Let's find the autoPlay button area.

autoplay_button_pattern = r'(<button\s+type="button"\s+disabled=\{locked\}\s+onClick=\{onToggleAutoPlay\}.*?>)(.*?)(</button>)'
def replacement(match):
    btn_open = match.group(1)
    btn_inner = match.group(2)
    btn_close = match.group(3)
    
    # If autoPlay is on, show the round count input
    return f"""{{autoPlay ? (
          <div className="flex h-9 min-w-0 items-center gap-1 rounded-full border border-bet-green bg-bet-green px-1.5">
            <button
              type="button"
              disabled={{locked}}
              onClick={{onToggleAutoPlay}}
              aria-pressed
              className="min-w-0 flex-1 truncate text-[11px] font-medium text-bet-green-foreground text-left"
            >
              Auto ({autoPlayRounds})
            </button>
            <input
              type="number"
              min="1"
              max="100"
              value={{autoPlayRounds ?? 10}}
              onChange={{(e) => onAutoPlayRounds?.(Math.max(1, parseInt(e.target.value) || 1))}}
              className="h-7 w-9 shrink-0 rounded-full border border-white/20 bg-black/20 px-1 text-center text-[10px] font-bold text-white outline-none"
            />
          </div>
        ) : (
          {btn_open}
            {btn_inner}
          {btn_close}
        )}}"""

content = re.sub(autoplay_button_pattern, replacement, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
