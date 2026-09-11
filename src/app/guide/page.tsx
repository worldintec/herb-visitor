"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  HelpCircle,
  Search,
  Map as MapIcon,
  Bell,
  User,
  KeyRound,
  UserPlus,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react"
import { GUIDE_SECTIONS, GUIDE_INTRO_TEXT } from "@/data/guide"

const SECTION_ICONS: Record<string, LucideIcon> = {
  search: Search,
  map: MapIcon,
  news: Bell,
  mypage: User,
  account: KeyRound,
  register: UserPlus,
  notes: BookOpen,
  photos: Camera,
}

export default function GuidePage() {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set([GUIDE_SECTIONS[0]?.id].filter(Boolean) as string[])
  )

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <div className="hero-gradient px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle size={20} className="text-white" />
          <h1 className="text-xl font-bold text-white">使い方ガイド</h1>
        </div>
        <p className="text-white/80 text-sm">{GUIDE_INTRO_TEXT}</p>
      </div>

      {/* セクション（アコーディオン） */}
      <div className="px-4 pt-4 pb-5 space-y-3">
        {GUIDE_SECTIONS.map((section) => {
          const isOpen = openIds.has(section.id)
          const Icon = SECTION_ICONS[section.id] ?? HelpCircle
          return (
            <section
              key={section.id}
              id={section.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden scroll-mt-4"
            >
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                aria-expanded={isOpen}
              >
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-herb-primary" />
                </div>
                <h3 className="flex-1 font-semibold text-sm text-herb-text">
                  {section.title}
                </h3>
                <ChevronDown
                  size={18}
                  className={`text-herb-text-secondary transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-herb-border space-y-3">
                  {section.lead && (
                    <p className="text-sm text-herb-text leading-relaxed">
                      {section.lead}
                    </p>
                  )}

                  {section.body.length > 0 && (
                    <ul className="space-y-1.5">
                      {section.body.map((line, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-sm text-herb-text-secondary leading-relaxed"
                        >
                          <span className="text-herb-primary mt-0.5">・</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.showImagePlaceholder && (
                    section.imageSrc && section.imageWidth && section.imageHeight ? (
                      <figure className="rounded-xl overflow-hidden border border-herb-border bg-green-50">
                        <Image
                          src={section.imageSrc}
                          alt={section.imageAlt ?? section.imageCaption ?? section.title}
                          width={section.imageWidth}
                          height={section.imageHeight}
                          sizes="(max-width: 640px) 100vw, 480px"
                          className="w-full h-auto block"
                        />
                        {section.imageCaption && (
                          <figcaption className="text-xs text-herb-text-secondary text-center py-1.5 border-t border-herb-border">
                            {section.imageCaption}
                          </figcaption>
                        )}
                      </figure>
                    ) : (
                      <div className="rounded-xl overflow-hidden border border-dashed border-herb-border bg-green-50 aspect-video flex flex-col items-center justify-center gap-1">
                        <ImageIcon size={28} className="text-green-300" />
                        <span className="text-xs text-green-600/70 font-medium">
                          {section.imageCaption ?? "画像準備中"}
                        </span>
                      </div>
                    )
                  )}

                  {section.tips && section.tips.length > 0 && (
                    <div className="bg-green-50 rounded-xl px-3 py-2.5 space-y-1">
                      {section.tips.map((tip, i) => (
                        <p
                          key={i}
                          className="text-xs text-herb-text-secondary leading-relaxed"
                        >
                          💡 {tip}
                        </p>
                      ))}
                    </div>
                  )}

                  {section.links && section.links.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      {section.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="flex items-center justify-between bg-herb-primary/5 hover:bg-herb-primary/10 text-herb-primary rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors"
                        >
                          {link.label}
                          <ChevronRight size={14} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
