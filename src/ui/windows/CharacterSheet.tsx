/** Character sheet: attributes, vitals, and the 15 skills grouped by rank. */

import { CLASSES } from '@/data/classes';
import { RACES } from '@/data/races';
import { ATTRS, SKILLS, type SkillId } from '@/data/skillsDef';
import { xpThreshold } from '@/systems/skills';
import { gameApi, useUi } from '@/ui/store';
import { PixelHeading } from '@/ui/widgets/PixelHeading';

export function CharacterSheet() {
  useUi((s) => s.charVersion);
  const c = gameApi().getCharacter();
  if (!c) return null;

  const rank = (s: SkillId): 'major' | 'minor' | 'misc' =>
    c.major.includes(s) ? 'major' : c.minor.includes(s) ? 'minor' : 'misc';

  const groups: Array<['major' | 'minor' | 'misc', string]> = [
    ['major', 'Major'],
    ['minor', 'Minor'],
    ['misc', 'Miscellaneous'],
  ];

  return (
    <div className="vm-center vm-fade-in" style={{ pointerEvents: 'auto' }}>
      <div className="vm-dim" />
      <div className="vm-panel" style={{ width: 640, maxHeight: '86vh', overflowY: 'auto', padding: 'var(--sp-5)', position: 'relative' }}>
        <PixelHeading text={c.name.toUpperCase()} scale={2} gradient={['#ffc97e', '#c25f1d']} />
        <div style={{ color: 'var(--ink-dim)', margin: '6px 0 0' }}>
          Level {c.level} {CLASSES.find((k) => k.id === c.clazz)?.name} ·{' '}
          {RACES.find((r) => r.id === c.race)?.name}
          {c.levelProgress > 0 && (
            <span style={{ color: 'var(--ink-fade)' }}> · progress {Math.min(c.levelProgress, 10)}/10</span>
          )}
        </div>
        <hr className="vm-rule" />

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--sp-5)' }}>
          <div>
            {ATTRS.map((a) => (
              <div key={a.id} className="vm-row" style={{ padding: '2px 0' }} title={a.blurb}>
                <span className="vm-label">{a.name}</span>
                <span style={{ color: 'var(--ink)' }}>{c.attrs[a.id]}</span>
              </div>
            ))}
            <hr className="vm-rule" />
            <div className="vm-row" style={{ padding: '2px 0' }}>
              <span className="vm-label">Health</span>
              <span style={{ color: 'var(--blood)' }}>
                {Math.round(c.hp)}/{c.hpMax}
              </span>
            </div>
            <div className="vm-row" style={{ padding: '2px 0' }}>
              <span className="vm-label">Magicka</span>
              <span style={{ color: 'var(--arcane)' }}>
                {Math.round(c.mp)}/{c.mpMax}
              </span>
            </div>
            <div className="vm-row" style={{ padding: '2px 0' }}>
              <span className="vm-label">Fatigue</span>
              <span style={{ color: 'var(--moss)' }}>
                {Math.round(c.fat)}/{c.fatMax}
              </span>
            </div>
            <div className="vm-row" style={{ padding: '2px 0' }}>
              <span className="vm-label">Gold</span>
              <span style={{ color: 'var(--ember)' }}>{c.gold}</span>
            </div>
          </div>

          <div>
            {groups.map(([g, label]) => (
              <div key={g} style={{ marginBottom: 'var(--sp-3)' }}>
                <div className="vm-label" style={{ marginBottom: 4, color: g === 'major' ? 'var(--verdigris)' : undefined }}>
                  {label}
                </div>
                {SKILLS.filter((s) => rank(s.id) === g).map((s) => {
                  const xp = c.skillXp[s.id];
                  const need = xpThreshold(c.skills[s.id]);
                  return (
                    <div key={s.id} className="vm-row" style={{ padding: '1px 0' }} title={`${Math.floor(xp)}/${need} xp`}>
                      <span style={{ color: g === 'misc' ? 'var(--ink-fade)' : 'var(--ink-dim)' }}>{s.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 50,
                            height: 3,
                            background: 'rgba(6,8,8,0.8)',
                            position: 'relative',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: `${Math.min(100, (xp / need) * 100)}%`,
                              background: 'var(--verdigris-dim)',
                            }}
                          />
                        </span>
                        <span style={{ color: 'var(--ink)', width: 24, textAlign: 'right' }}>{c.skills[s.id]}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <hr className="vm-rule" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="vm-btn-frame" onClick={() => gameApi().closeTop()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
