type AddressedOptions = { readonly continuationToken: string };

type ChannelSender<TMessage, TOptions extends AddressedOptions, TResult> = {
  send(message: TMessage, options: TOptions): Promise<TResult>;
} | {
  from(address: string): {
    send(message: TMessage, options: Omit<TOptions, "continuationToken">): Promise<TResult>;
  };
};

/**
 * Bridges the authored channel API while testing Eve's handle migration.
 * The old continuation token is a channel-local address here, not a browser
 * credential. Keep its exact value and all authenticated delivery options.
 */
export function sendEveChannelMessage<TMessage, const TOptions extends AddressedOptions, TResult>(
  channel: ChannelSender<TMessage, TOptions, TResult>,
  message: TMessage,
  options: TOptions,
): Promise<TResult> {
  if ("send" in channel) return channel.send(message, options);
  const { continuationToken, ...deliveryOptions } = options;
  if (!continuationToken) throw new Error("Eve channel delivery requires a conversation address.");
  return channel.from(continuationToken).send(message, deliveryOptions);
}

/** Preserves the target channel's receive hook when a schedule starts work. */
export function sendEveChannelTarget<TChannel, TMessage, TTarget, TAuth, TResult>(
  scheduler: {
    receive(channel: TChannel, input: { message: TMessage; target: TTarget; auth: TAuth }): Promise<TResult>;
  } | {
    to(channel: TChannel, target: TTarget): {
      send(message: TMessage, options: { auth: TAuth }): Promise<TResult>;
    };
  },
  channel: TChannel,
  input: { message: TMessage; target: TTarget; auth: TAuth },
): Promise<TResult> {
  return "receive" in scheduler
    ? scheduler.receive(channel, input)
    : scheduler.to(channel, input.target).send(input.message, { auth: input.auth });
}
