import { useMemo, useState, type FormEvent } from "react";
import { Card } from "@moneypulse/ui";

import {
  copilotService,
  type CopilotConversationMessage,
  type CopilotEngineInput
} from "./lib/ai";
import { getLocale } from "./lib/format";
import { useI18n, type LanguageCode } from "./lib/i18n";

type MessageRole = "assistant" | "user";

export interface CopilotMessage {
  id: string;
  role: MessageRole;
  text: string;
}

function toConversationHistory(messages: CopilotMessage[]): CopilotConversationMessage[] {
  return messages.map((message) => ({
    role: message.role,
    text: message.text
  }));
}

export function getSuggestedCopilotPrompts(
  t: (key: string) => string
): ReadonlyArray<string> {
  return [
    t("copilot.prompt.health"),
    t("copilot.prompt.affordability"),
    t("copilot.prompt.budget"),
    t("copilot.prompt.goals"),
    t("copilot.prompt.forecast"),
    t("copilot.prompt.survival")
  ];
}

export function buildIntroMessage(t: (key: string) => string): CopilotMessage {
  return {
    id: "intro",
    role: "assistant",
    text: `${t("copilot.intro")} ${t("copilot.distinction")}`
  };
}

export async function createCopilotReply(
  params: CopilotEngineInput & {
    currency: string;
    language: LanguageCode;
    message: string;
    turnId?: number;
    history?: CopilotConversationMessage[];
  }
): Promise<CopilotMessage> {
  const response = await copilotService.generateCopilotReply({
    ...params,
    locale: getLocale(params.language),
    message: params.message,
    history: params.history
  });

  return {
    id: `assistant-${params.turnId ?? 0}-${response.intent}`,
    role: "assistant",
    text: response.answer
  };
}

function createUserMessage(message: string, turnId: number): CopilotMessage {
  return {
    id: `user-${turnId}`,
    role: "user",
    text: message
  };
}

export async function appendCopilotTurn(
  messages: CopilotMessage[],
  params: CopilotEngineInput & {
    currency: string;
    language: LanguageCode;
    message: string;
  }
): Promise<CopilotMessage[]> {
  const trimmedMessage = params.message.trim();

  if (!trimmedMessage) {
    return messages;
  }

  const turnId = messages.length;
  const assistantMessage = await createCopilotReply({
    ...params,
    message: trimmedMessage,
    turnId,
    history: toConversationHistory(messages)
  });

  return [
    ...messages,
    createUserMessage(trimmedMessage, turnId),
    assistantMessage
  ];
}

export function CopilotScreen(
  props: CopilotEngineInput & {
    currency: string;
    hasFinancialContext: boolean;
  }
) {
  const { accounts, budgets, currency, goals, hasFinancialContext, profile, recurringItems, transactions } =
    props;
  const { language, t } = useI18n();
  const translateKey = (key: string) => t(key as Parameters<typeof t>[0]);
  const introMessage = useMemo(() => buildIntroMessage(translateKey), [t]);
  const [messages, setMessages] = useState<CopilotMessage[]>([introMessage]);
  const [draft, setDraft] = useState("");

  const suggestedPrompts = useMemo(() => getSuggestedCopilotPrompts(translateKey), [t]);

  async function sendMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    const currentMessages = messages;
    const nextUserMessage = createUserMessage(trimmedMessage, currentMessages.length);
    setMessages([...currentMessages, nextUserMessage]);

    const assistantMessage = await createCopilotReply({
      profile,
      accounts,
      transactions,
      recurringItems,
      budgets,
      goals,
      currency,
      language,
      message: trimmedMessage,
      turnId: currentMessages.length,
      history: toConversationHistory(currentMessages)
    });

    setMessages((latest) => [...latest, assistantMessage]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  return (
    <>
      <Card title={t("copilot.title")} subtitle={t("copilot.subtitle")}>
        <div className="copilot-panel">
          <div className="copilot-meta">
            <span className="status-tag status-tag--muted">{t("copilot.badge")}</span>
            <span className="status-tag status-tag--info">{t("copilot.dataSource")}</span>
          </div>

          {!hasFinancialContext ? (
            <p className="helper-copy" data-testid="copilot-empty-context">
              {t("copilot.emptyContext")}
            </p>
          ) : null}

          <section className="copilot-suggestions" aria-label={t("copilot.suggestions")}>
            <span className="copilot-suggestions__label">{t("copilot.suggestions")}</span>
            <div className="copilot-chip-list">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={prompt}
                  className="copilot-chip"
                  data-testid={`copilot-prompt-${index}`}
                  onClick={() => void sendMessage(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        </div>
      </Card>

      <Card title={t("copilot.conversationTitle")} subtitle={t("copilot.conversationSubtitle")}>
        <div className="copilot-panel">
          <CopilotMessageList messages={messages} />

          <form className="copilot-input" data-testid="copilot-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>{t("copilot.inputLabel")}</span>
              <input
                data-testid="copilot-input"
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("copilot.inputPlaceholder")}
                value={draft}
              />
            </label>
            <button className="primary-button" data-testid="copilot-send" type="submit">
              {t("copilot.send")}
            </button>
          </form>
        </div>
      </Card>
    </>
  );
}

export function CopilotMessageList(props: { messages: CopilotMessage[] }) {
  const { messages } = props;
  const { t } = useI18n();

  return (
    <ol className="copilot-thread" data-testid="copilot-thread">
      {messages.map((message) => (
        <li
          key={message.id}
          className={
            message.role === "assistant"
              ? "copilot-message copilot-message--assistant"
              : "copilot-message copilot-message--user"
          }
          data-testid={`copilot-message-${message.role}`}
        >
          <span className="copilot-message__role">
            {message.role === "assistant"
              ? t("copilot.assistant")
              : t("copilot.user")}
          </span>
          <p>{message.text}</p>
        </li>
      ))}
    </ol>
  );
}
