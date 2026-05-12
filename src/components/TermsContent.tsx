// Single source of truth for the Terms of Use document.
// Used by /terms and both onboarding terms steps.
//
// To update the text, edit only this file — both pages re-read it automatically.

export const TERMS_LAST_UPDATED = "May 12, 2026";

export function TermsContent() {
  return (
    <article className="flex flex-col gap-6 text-[15px] leading-relaxed text-[var(--fg-1)]">
      <header className="flex flex-col gap-2">
        <p className="muted text-xs uppercase tracking-wider">
          Last updated · {TERMS_LAST_UPDATED}
        </p>
        <p>
          These Terms of Use (&ldquo;Agreement&rdquo;) set forth the general terms and conditions of
          your use of the ZenWallet extension application, mobile application, and web dashboard
          application (&quot;ZenWallet Application&quot;) and any of its related products and
          services (collectively, &ldquo;Services&rdquo;).
        </p>
        <p>
          This Agreement is legally binding between you (&ldquo;User&rdquo;, &ldquo;you&rdquo; or
          &ldquo;your&rdquo;) and this application developer (&ldquo;Operator&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;). If you are entering into this
          Agreement on behalf of a business or other legal entity, you represent that you have the
          authority to bind such an entity to this Agreement, in which case the terms
          &ldquo;User&rdquo;, &ldquo;you&rdquo; or &ldquo;your&rdquo; shall refer to such entity.
        </p>
        <p>
          If you do not have such authority, or if you do not agree with the terms of this
          Agreement, you must not accept this Agreement and may not access and use the ZenWallet
          Application and Services. By accessing and using the ZenWallet Application and Services,
          you acknowledge that you have read, understood, and agree to be bound by the terms of
          this Agreement. You acknowledge that this Agreement is a contract between you and the
          Operator, even though it is electronic and is not physically signed by you, and it
          governs your use of the ZenWallet Application and Services.
        </p>
      </header>

      <Section title="Accounts and membership">
        <p>
          If you create a wallet in the ZenWallet Application, you are responsible for maintaining
          the security of your wallet and you are fully responsible for all activities that occur
          with the wallet and any other actions taken in connection with it. You should understand
          that we do not have access to any wallet-related information on our side, nor are we able
          to send it to any other party.
        </p>
        <p>
          All such information is stored locally on your device(s) which we do not have access to
          and you bear full responsibility for its (their) safety. Your wallet private keys/seed
          phrases are not backed up along with other data so if you delete ZenWallet Application,
          it will be impossible to restore your keys from a backup.
        </p>
      </Section>

      <Section title="Privacy policy">
        <p>
          We respect your privacy and are committed to protecting it through our compliance with
          this privacy policy (&ldquo;Policy&rdquo;). This Policy describes the types of
          information we may collect from you or that you may provide on the ZenWallet Application,
          ZenWallet.App website, and any of their related products and services, and our practices
          for collecting, using, maintaining, protecting, and disclosing that information. By
          accessing and using the Services, you acknowledge that you have read, understood, and
          agree to be bound by the terms of this Policy. This Policy does not apply to the
          practices of companies that we do not own or control, or to individuals that we do not
          employ or manage.
        </p>
      </Section>

      <Section title="Information category">
        <p>
          For the purposes of the given document, we would like to classify information into the
          following categories: Data that is used for wallet creation, import, and export (i.e.,
          seed phrase, private key, etc.) (&ldquo;Sensitive information&rdquo;), personally
          identifiable information (i.e., data that could potentially identify you as an
          individual) (&ldquo;Personal information&rdquo;), and Non-personally identifiable
          information (i.e., information that cannot be used to identify who you are)
          (&ldquo;Non-personal information&rdquo;). This Policy covers all the categories and will
          tell you how we might collect and use each type.
        </p>
      </Section>

      <Section title="Sensitive information">
        <p>
          Your Sensitive information is not collected or stored by us. In particular, it is not
          sent anywhere, is not stored anywhere except your device, and is not included in backups
          of the operating system. We are committed to making sure your information is protected
          and we employ several mechanisms to keep your information safe, including on-device
          encryption, verification and authentication by password or biometrics, and securing all
          network connections with industry-standard transport layer security. However, even with
          these precautions taken by us, the safety of your device and your seed phrase or backup
          data is solely your responsibility.
        </p>
      </Section>

      <Section title="Personal information & Non-personal information">
        <p>
          You can access and use the Services without telling us who you are or revealing any
          information by which someone could identify you as a specific, identifiable individual.
          In other words, no Personal information is collected by our Services. This applies to all
          categories of users, including children under the age of 18. Please note that our
          extension and app have been uploaded to the Store on desktop browsers (Chrome, Brave,
          Edge &amp; Firefox) and mobile (App Store and Play Store). These stores may track some of
          your information and activities including but not limited to log data, cookies, etc.
        </p>
      </Section>

      <Section title="Disclosure of information">
        <p>We do not share your information with anyone or for any reason.</p>
      </Section>

      <Section title="Security measures">
        <p>
          In the event we become aware that the security of the Services has been compromised as a
          result of external activity, including, but not limited to, security attacks or fraud, we
          reserve the right to take reasonably appropriate measures, including, but not limited to,
          investigation and reporting, as well as notification to and cooperation with law
          enforcement authorities. In such cases, we will make reasonable efforts to notify
          affected individuals if we believe that there is a reasonable risk of harm to them or if
          notice is otherwise required by law. When we do, we will post a notice on the Services.
        </p>
      </Section>

      <Section title="Transaction infrastructure fees">
        <p>
          ZenWallet infrastructure may apply an additional service fee to each outgoing blockchain
          transaction in order to maintain the operability, security, and integrity of the system.
          Such fees may be visible within the transaction details on official blockchain and
          cryptocurrency explorers. Depending on the blockchain network and transaction type,
          transfers may utilize mechanisms and methods including, but not limited to, Disperse
          Ether for Ethereum, Disperse Token for ERC-20 tokens, instructions for Solana and
          Polkadot transfers, and other similar transaction processing methods. The amount and
          structure of such infrastructure fees are determined solely by the infrastructure
          developers and/or providers, and not by the owner, operator, or distributor of the
          ZenWallet product.
        </p>
      </Section>

      <Section title="Do Not Track signals">
        <p>
          Some browsers incorporate a Do Not Track feature that signals to websites you visit that
          you do not want to have your online activity tracked. Tracking is not the same as using
          or collecting information in connection with a website. For these purposes, tracking
          refers to collecting personally identifiable information from consumers who use or visit
          a website or online service as they move across different websites over time. The
          Services do not track its visitors over time and across third-party websites. However,
          some third-party websites may keep track of your browsing activities when they serve you
          content, which enables them to tailor what they present to you.
        </p>
      </Section>

      <Section title="Links to other resources">
        <p>
          Although the ZenWallet Application and Services may link to other resources (such as
          websites, other applications, etc.), we are not, directly or indirectly, implying any
          approval, association, sponsorship, endorsement, or affiliation with any linked resource,
          unless specifically stated herein. We are not responsible for examining or evaluating,
          and we do not warrant the offerings of any businesses or individuals or the content of
          their resources.
        </p>
        <p>
          We do not assume any responsibility or liability for the actions, products, services, and
          content of any other third parties. You should carefully review the legal statements and
          other conditions of use of any resource that you access through a link in the ZenWallet
          Application. Your linking to any other off-site resources is at your own risk.
        </p>
      </Section>

      <Section title="Prohibited uses">
        <p>
          In addition to other terms as set forth in the Agreement, you are prohibited from using
          the ZenWallet Application and Services:
        </p>
        <ul className="list-disc pl-6 flex flex-col gap-1.5">
          <li>For any unlawful purpose.</li>
          <li>To solicit others to perform or participate in any unlawful acts.</li>
          <li>
            To violate any international, federal, provincial, or state regulations, rules, laws,
            or local ordinances.
          </li>
          <li>
            To infringe upon or violate our intellectual property rights or the intellectual
            property rights of others.
          </li>
          <li>
            To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate
            based on gender, sexual orientation, religion, ethnicity, race, age, national origin,
            or disability.
          </li>
          <li>To submit false or misleading information.</li>
          <li>
            To upload or transmit viruses or any other type of malicious code that will or may be
            used in any way that will affect the functionality or operation of the ZenWallet
            Application and Services, third-party products and services, or the Internet.
          </li>
          <li>To spam, phish, pharm, pretext, spider, crawl, or scrape.</li>
          <li>For any obscene or immoral purpose.</li>
          <li>
            To interfere with or circumvent the security features of the ZenWallet Application and
            Services, third-party products and services, or the Internet.
          </li>
        </ul>
      </Section>

      <Section title="Intellectual property rights">
        <p>
          &ldquo;Intellectual Property Rights&rdquo; means all present and future rights conferred
          by statute, common law, or equity in or in relation to any copyright and related rights,
          trademarks, designs, patents, inventions, goodwill, and the right to sue for passing off,
          rights to inventions, rights to use, and all other intellectual property rights, in each
          case whether registered or unregistered and including all applications and rights to
          apply for and be granted, rights to claim priority from, such rights and all similar or
          equivalent rights or forms of protection and any other results of intellectual activity
          which subsist or will subsist now or in the future in any part of the world.
        </p>
        <p>
          This Agreement does not transfer to you any intellectual property owned by the Operator
          or third parties, and all rights, titles, and interests in and to such property will
          remain (as between the parties) solely with the Operator. All trademarks, service marks,
          graphics, and logos used in connection with the ZenWallet Application and Services, are
          trademarks or registered trademarks of the Operator or its licensors.
        </p>
        <p>
          Other trademarks, service marks, graphics, and logos used in connection with the
          ZenWallet Application and Services may be the trademarks of other third parties. Your use
          of the ZenWallet Application and Services grants you no right or license to reproduce or
          otherwise use any of the Operator or third-party trademarks.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by applicable law, in no event will the Operator, its
          affiliates, directors, officers, employees, agents, suppliers, or licensors be liable to
          any person for any indirect, incidental, special, punitive, cover or consequential
          damages (including, without limitation, damages for lost profits, revenue, sales,
          goodwill, use of content, impact on business, business interruption, loss of anticipated
          savings, loss of business opportunity) however caused, under any theory of liability,
          including, without limitation, contract, tort, warranty, breach of statutory duty,
          negligence or otherwise, even if the liable party has been advised as to the possibility
          of such damages or could have foreseen such damages.
        </p>
      </Section>

      <Section title="Indemnification">
        <p>
          You agree to indemnify and hold the Operator and its affiliates, directors, officers,
          employees, agents, suppliers, and licensors harmless from and against any liabilities,
          losses, damages, or costs, including reasonable attorneys&rsquo; fees, incurred in
          connection with or arising from any third-party allegations, claims, actions, disputes,
          or demands asserted against any of them as a result of or relating to your use of the
          ZenWallet Application and Services or any willful misconduct on your part.
        </p>
      </Section>

      <Section title="Severability">
        <p>
          All rights and restrictions contained in this Agreement may be exercised and shall be
          applicable and binding only to the extent that they do not violate any applicable laws
          and are intended to be limited to the extent necessary so that they will not render this
          Agreement illegal, invalid, or unenforceable. If any provision or portion of any
          provision of this Agreement shall be held to be illegal, invalid, or unenforceable by a
          court of competent jurisdiction, it is the intention of the parties that the remaining
          provisions or portions thereof shall constitute their Agreement with respect to the
          subject matter hereof, and all such remaining provisions or portions thereof shall remain
          in full force and effect.
        </p>
      </Section>

      <Section title="Dispute resolution">
        <p>
          The formation, interpretation, and performance of this Agreement and any disputes arising
          out of it shall be governed by the substantive and procedural laws of the United Nations
          Convention without regard to its rules on conflicts or choice of law and, to the extent
          applicable, the laws of the United Nations Convention. The exclusive jurisdiction and
          venue for actions related to the subject matter hereof shall be the courts located in
          the United Nations Convention, and you hereby submit to the personal jurisdiction of
          such courts. You hereby waive any right to a jury trial in any proceeding arising out of
          or related to this Agreement. The United Nations Convention on Contracts for the
          International Sale of Goods does not apply to this Agreement.
        </p>
      </Section>

      <Section title="Changes and amendments">
        <p>
          We reserve the right to modify this Agreement or its terms related to the ZenWallet
          Application and Services at any time at our discretion. When we do, we will revise the
          updated date at the bottom of this page. We may also provide notice to you in other ways
          at our discretion, such as through the contact information you have provided.
        </p>
        <p>
          An updated version of this Agreement will be effective immediately upon the posting of
          the revised Agreement unless otherwise specified. Your continued use of the ZenWallet
          Application and Services after the effective date of the revised Agreement (or such
          other act specified at that time) will constitute your consent to those changes.
        </p>
      </Section>

      <Section title="Acceptance of these terms">
        <p>
          You acknowledge that you have read this Agreement and agree to all its terms and
          conditions. By accessing and using the ZenWallet Application and Services you agree to
          be bound by this Agreement. If you do not agree to abide by the terms of this Agreement,
          you are not authorized to access or use the ZenWallet Application and Services.
        </p>
      </Section>

      <Section title="Contacting us">
        <p>
          If you have any questions, concerns, or complaints regarding this Agreement, we encourage
          you to contact us using the details below:
        </p>
        <p className="font-mono text-sm">
          Email:{" "}
          <a
            href="mailto:agent@zenwallet.app"
            className="text-[var(--accent)] hover:underline"
          >
            agent@zenwallet.app
          </a>
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-base font-semibold text-[var(--fg-0)] mt-2">{title}</h2>
      {children}
    </section>
  );
}
