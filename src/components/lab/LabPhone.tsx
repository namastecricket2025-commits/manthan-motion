import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The phone composition of the lab.
 *
 * On a wide screen a bench rail works: every chapter is one glance away. On a
 * phone the same rail wraps into two or three rows, the four lab tools take
 * another two, and the bench itself starts below the fold. The phone instead
 * gets two levels — a grouped list of benches, then one bench with a back
 * bar. The desktop rail is untouched.
 */

const PHONE_QUERY = "(max-width: 760px)";

export function useLabPhone(): boolean {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const sync = () => setPhone(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return phone;
}

export type LabPhoneTopic = {
  id: string;
  label: string;
  blurb: string;
};

export type LabPhoneGroup = {
  label: string;
  topics: LabPhoneTopic[];
};

export function LabPhoneLibrary({
  subject,
  groups,
  onOpen,
}: {
  subject: string;
  groups: LabPhoneGroup[];
  onOpen: (id: string) => void;
}) {
  const count = groups.reduce((total, group) => total + group.topics.length, 0);

  return (
    <div className="lab-phone">
      <div className="lab-phone-intro">
        <p className="apple-lab-micro">
          {subject} · {count} benches
        </p>
        <h2 className="lab-phone-heading">Choose a bench</h2>
        <p className="lab-phone-lede">
          Open one experiment at a time. Its bench and controls get the whole
          screen.
        </p>
      </div>

      {groups.map((group) => (
        <section className="lab-phone-group" key={group.label}>
          <div className="lab-phone-group-head">
            <p className="lab-phone-group-label">{group.label}</p>
            <span className="lab-phone-group-count">{group.topics.length}</span>
          </div>
          <div className="lab-phone-list">
            {group.topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className="lab-phone-row"
                onClick={() => onOpen(topic.id)}
              >
                <span className="lab-phone-row-copy">
                  <span className="lab-phone-row-title">{topic.label}</span>
                  <span className="lab-phone-row-blurb">{topic.blurb}</span>
                </span>
                <span className="lab-phone-row-go" aria-hidden="true">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function LabPhoneBar({
  subject,
  label,
  onBack,
  right,
}: {
  subject: string;
  label: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="lab-phone-bar">
      <button type="button" className="lab-phone-back" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>All {subject.toLowerCase()}</span>
      </button>
      <span className="lab-phone-here">{label}</span>
      {right ? <div className="lab-phone-bar-extra">{right}</div> : null}
    </div>
  );
}
