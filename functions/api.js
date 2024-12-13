const supabase = require('./supabase');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto'); 
const serverless = require("serverless-http");
const axios = require('axios')
const bodyParser = require('body-parser');

const app = express();
const route = express.Router();

app.use(cors());
app.use(bodyParser.json());

route.get('/start_msg/:uuid', async (req, res) => {
    // Récupération du paramètre UUID depuis la requête
    const { uuid } = req.params;

    try {
        // Récupération des informations de l'utilisateur dans la table 'users_infos'
        const { data: checkedData, error: checkedError } = await supabase
            .from('users_infos')
            .select('msg_bool, public_key')
            .eq('uuid', uuid)
            .single();

        // Gestion de l'erreur en cas de problème lors de la requête à la base de données
        if (checkedError) {
            return res.status(400).json({ error: checkedError.message });
        }

        // Vérification si msg_bool est false et public_key est null
        if (checkedData.msg_bool === false && checkedData.public_key === null) {
            // Action à exécuter si les deux conditions sont remplies
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,  // Length of the key in bits
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            });

            if(publicKey && privateKey) {
                const { error } = await supabase
                    .from('users_infos')
                    .update({ public_key: publicKey , msg_bool: true})
                    .eq('uuid', uuid)

                res.status(200).json({privateKey});
            }


            // Par exemple, on peut envoyer un message d'erreur
            return res.status(400).json({ error: 'Message non activé et clé publique manquante.' });
        }

        // Si aucune erreur, log des données pour debug
        console.log('Données récupérées :', checkedData);

        // Réponse réussie avec les données
        res.status(200).json('le user a ete deja verifier');

    } catch (error) {
        // Gestion des erreurs inattendues
        console.error('Erreur serveur:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});





route.post('/register/:email/:password/:username', async (req, res) => {
    const { email, password, username } = req.params;
    
    // Step 1: Register the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        return res.status(400).json({ error: authError.message });
    }


    // Step 3: Insert the user along with the public key into the 'users_infos' table
    const { data: userData, error: userError } = await supabase
        .from('users_infos')
        .insert([{ username, email, uuid: authData.user.id }]);

    if (userError) {
        return res.status(400).json({ error: userError.message });
    }

    // Step 4: Return the private key to the user
    res.status(200).json({ message: 'User registered successfully' });
});


route.get('/contact/:contact_id/messages/:userId', async (req, res) => {
  const { contact_id } = req.params;
  const { userId } = req.params;

  try {
    // Récupérer les informations du contact
    const { data: userData, error: userError } = await supabase
      .from('users_infos')
      .select('avatar, username, badge, image_updated_at')
      .eq('uuid', contact_id)
      .single();

    if (userError) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des infos utilisateur.' });
    }

    // Récupérer les messages entre les deux utilisateurs
    const { data: messages, error: messageError } = await supabase
      .from('message')
      .select()
      .or(`and(fromid.eq.${userId},toid.eq.${contact_id}),and(fromid.eq.${contact_id},toid.eq.${userId})`)
      .order('id', { ascending: true });

    if (messageError) {
      return res.status(500).json( messageError );
    }

      const {data: Update } = await supabase
        .from('message')
        .update({ statue: true })
        .eq('fromid', contact_id)
        .eq('toid', userId)

    // Réponse avec les données de contact et messages
    res.status(200).json({
      contactInfo: userData,
      messages: messages || [],
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});


route.get('/community/:limit', async (req, res) => {
    const { limit } = req.params;

    try {
      // Récupérer les communautés depuis la table "community"
      const { data: communities, error } = await supabase
        .from('community')
        .select('uuid, name, description, tags, zap, members') // Sélectionnez les colonnes nécessaires ou utilisez '*' pour tout récupérer
        .order('created_at', { ascending: false }) // Trier par date de création, par exemple
        .limit(limit)
  
      // Vérifier s'il y a une erreur
      if (error) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des communautés.' });
      }
  
      // Retourner les données au client
      res.status(200).json({
        communities: communities || [],
      });
    } catch (error) {
      console.error('Erreur serveur lors de la récupération des communautés:', error.message);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
});



route.get('/communities/search/:query', async (req, res) => {
    const { query } = req.params;
  
    try {
      // Récupérer les communautés avec un filtre sur le nom, la description ou les tags
      const { data: communities, error: communityError } = await supabase
        .from('community')
        .select('uuid, name, description, tags, zap, members') // Colonnes nécessaires
        .or(
          `name.ilike.%${query}%,description.ilike.%${query}%`
        )
  
      // Vérifier s'il y a une erreur
      if (communityError) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des communautés.', communityError });
      }
  
      // Retourner les données au client
      res.status(200).json({
        communities: communities || [],
      });
    } catch (error) {
      console.error('Erreur serveur lors de la récupération des communautés:', error.message);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });
  
  




route.get('/api/UserSearch/:username', async (req, res) => {
    try {
        const { username } = req.params; // Fix the parameter name (use "username" instead of "userName")

        const { data: userData, error: userError } = await supabase
            .from('users_infos')
            .select('uuid, username, avatar, badge, image_updated_at')
            .like('username', '%'+username+'%');

        if (userError) {
            throw userError;
        }

        if (!userData || userData.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json(userData);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
});


route.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params; // Récupérer l'ID de l'utilisateur principal depuis les paramètres de la requête

        // Récupérer les données de l'utilisateur principal
        const { data: userData, error: userError } = await supabase
            .from('users_infos')
            .select('username, uuid, avatar, bios, badge, image_updated_at, token, banner')
            .eq('uuid', userId)
            .single();

        if (userError) {
            throw userError;
        }

        // Récupérer les données des utilisateurs suivis par l'utilisateur principal dans la table "follow"
        const { data: followData, error: followError } = await supabase
            .from('follow')
            .select('toid')
            .eq('fromid', userId)
            .limit(5); // Limiter à 5 utilisateurs suivis

        if (followError) {
            throw followError;
        }

        // Récupérer les détails des utilisateurs suivis
        const followIds = followData.map(follow => follow.toid);
        const { data: followUserData, error: followUserError } = await supabase
            .from('users_infos')
            .select('username, uuid, avatar, badge')
            .in('uuid', followIds);

        if (followUserError) {
            throw followUserError;
        }

        // Récupérer le nombre de personnes que l'utilisateur suit (followers)
        const { data: followersCountData, error: followersCountError } = await supabase
            .from('follow')
            .select('*')
            .eq('toid', userId);

        if (followersCountError) {
            throw followersCountError;
        }

        // Récupérer le nombre de personnes qui suivent l'utilisateur (following)
        const { data: followingCountData, error: followingCountError } = await supabase
            .from('follow')
            .select('*')
            .eq('fromid', userId);

        if (followingCountError) {
            throw followingCountError;
        }

        // Récupérer le nombre de posts de type "image"
        const { data: imagePostsData, error: imagePostsError } = await supabase
            .from('post')
            .select('id, src')
            .eq('type', 'post')
            .eq('uuid', userId);

        if (imagePostsError) {
            throw imagePostsError;
        }

        // Récupérer le nombre de posts de type "shorts"
        const { data: shortsPostsData, error: shortsPostsError } = await supabase
            .from('post')
            .select('id, src, text, poster_src')
            .eq('type', 'video')
            .eq('uuid', userId);

        if (shortsPostsError) {
            throw shortsPostsError;
        }

        // Récupérer le nombre de posts de type "ripple"
        const { data: ripplePostsData, error: ripplePostsError } = await supabase
            .from('post')
            .select('id, text')
            .eq('type', 'note')
            .eq('uuid', userId);

        if (ripplePostsError) {
            throw ripplePostsError;
        }

        // Organiser les données pour la réponse
        const responseData = {
            user: userData,
            follows: followUserData,
            followersCount: followersCountData.length,
            followingCount: followingCountData.length,
            PostsCount: imagePostsData.length + shortsPostsData.length + ripplePostsData.length,
            PostImage: imagePostsData,
            PostVideo: shortsPostsData,
            PostRipple: ripplePostsData,
        };

        res.send(responseData);
    } catch (error) {
        console.error('Erreur:', error.message);
        res.status(500).send('Erreur lors de la récupération des données depuis Supabase.');
    }
});






route.get('/api/contact/:userId', async (req, res) => {
    
    try {
        const userId = req.params.userId;

        // Interroger la base de données Supabase pour récupérer les utilisateurs suivis par userId
        const { data, error } = await supabase
            .from('follow')
            .select('toid')
            .eq('fromid', userId);

        if (error) {
            console.error('Erreur lors de la requête Supabase:', error.message);
            return res.status(500).send('Erreur lors de la récupération des données depuis Supabase.');
        }

        // Extraire les IDs des utilisateurs suivis
        const followedUserIds = data.map(item => item.toid);

        const usersInfoPromises = followedUserIds.map(async id => {
            // Récupérer le dernier message du contact dont le statut est faux (false)
            const { data: lastMessageData, error: lastMessageError } = await supabase
                .from('message')
                .select('message, created_at, type')
                .or(`and(fromid.eq.${id},toid.eq.${userId}),and(fromid.eq.${userId},toid.eq.${id})`)
                .order('created_at', { ascending: false })
                .limit(1)
            if (lastMessageError) {
                throw lastMessageError;
            }

            // Compter le nombre total de messages pour chaque contact
            const { data: messageCountData, error: messageCountError } = await supabase
                .from('message')
                .select('id')
                .eq('statue', false)
                .eq('toid', userId)
                .eq('fromid', id);

            if (messageCountError) {
                throw messageCountError;
            }

            const { data: contactuserinfos , error: contactuserinfoserror} = await supabase
                .from('users_infos')
                .select('username, avatar, uuid, image_updated_at')
                .eq('uuid', id)
                .single();

            if(contactuserinfoserror) {
                throw contactuserinfoserror;
            }
            return {
                userInfo: contactuserinfos,
                lastMessage: lastMessageData,
                messageCount: messageCountData.length,
            };
        });

        // Attendre que toutes les requêtes pour les informations des utilisateurs suivis soient terminées
        const usersInfoResults = await Promise.all(usersInfoPromises);
        const totalMessages = usersInfoResults.reduce((acc, cur) => acc + cur.messageCount, 0);
        // Trier les contacts par ordre décroissant de la date du dernier message
        const sortedContacts = usersInfoResults.sort((a, b) => {
            const lastMessageA = a.lastMessage[0]; // Supposant qu'il y a toujours un dernier message
            const lastMessageB = b.lastMessage[0]; // Supposant qu'il y a toujours un dernier message

            if (!lastMessageA || !lastMessageB) {
                return 0; // Si l'un des contacts n'a pas de dernier message, la comparaison est neutre
            }

            // Comparer les dates des derniers messages pour le tri
            return new Date(lastMessageB.created_at) - new Date(lastMessageA.created_at);
        });

        res.status(200).json({ contacts: sortedContacts, totalMessages });

    } catch (error) {
        console.error('Erreur:', error.message);
        res.status(500).send('Erreur lors de la récupération des données depuis Supabase.');
    }
});



route.get('/api/posts/following/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Récupérer les utilisateurs suivis par userId
        const { data: followedUsersData, error: followedUsersError } = await supabase
            .from('follow')
            .select('toid')
            .eq('fromid', userId);

        if (followedUsersError) {
            console.error('Erreur lors de la requête Supabase pour récupérer les utilisateurs suivis:', followedUsersError.message);
            return res.status(500).send('Erreur lors de la récupération des utilisateurs suivis depuis Supabase.');
        }

        // Extraire les IDs des utilisateurs suivis
        const followedUserIds = followedUsersData.map(item => item.toid);
        
        // Récupérer tous les posts des utilisateurs suivis depuis la table posts
        const { data: allPostsData, error: allPostsError } = await supabase
            .from('posts')
            .select('id, src, text, type, uuid, metadata, ad') // Ajouter uuid pour récupérer l'ID de l'utilisateur associé à chaque post
            .or(`uuid.in.(${followedUserIds.join(',')}),uuid.eq.${userId}`);

        if (allPostsError) {
            console.error('Erreur lors de la récupération des posts depuis Supabase:', allPostsError.message);
            return res.status(500).send('Erreur lors de la récupération des posts depuis Supabase.');
        }

        // Récupérer les informations de chaque utilisateur qui a posté un message
        const usersInfoPromises = allPostsData.map(async post => {
            const { data: userInfo, error: userError } = await supabase
                .from('users_infos')
                .select('username, avatar, badge, image_updated_at')
                .eq('uuid', post.uuid)
                .single();

            if (userError) {
                console.error('Erreur lors de la récupération des informations utilisateur depuis Supabase:', userError.message);
                return null; // Ignorer cet utilisateur s'il y a une erreur
            }

            return { username: userInfo.username, avatar: userInfo.avatar, badge: userInfo.badge, updated_at: userInfo.image_updated_at };
        });

        // Attendre que toutes les requêtes pour les informations des utilisateurs soient terminées
        const usersInfoResults = await Promise.all(usersInfoPromises);

        // Ajouter les informations de l'utilisateur à chaque post
        allPostsData.forEach((post, index) => {
            post.user = usersInfoResults[index];
        });

        // Récupérer le nombre de likes pour chaque post depuis la table likes
        const likesPromises = allPostsData.map(async post => {
            const { data: likesData, error: likesError } = await supabase
                .from('like')
                .select('id')
                .eq('post_id', post.id);

            if (likesError) {
                console.error('Erreur lors de la récupération des likes depuis Supabase:', likesError.message);
                return 0; // Retourner 0 likes en cas d'erreur
            }

            return likesData.length; // Nombre de likes pour ce post
        });

        // Attendre que toutes les requêtes pour les likes soient terminées
        const likesResults = await Promise.all(likesPromises);

        // Ajouter le nombre de likes à chaque post
        allPostsData.forEach((post, index) => {
            post.likesCount = likesResults[index];
        });


        
        // Vérifier si l'utilisateur a déjà aimé chaque post
        const userLikesPromises = allPostsData.map(async post => {
            const { data: userLikesData, error: userLikesError } = await supabase
                .from('like')
                .select('id')
                .eq('post_id', post.id)
                .eq('user_id', userId);

            if (userLikesError) {
                console.error('Erreur lors de la récupération des likes de l\'utilisateur depuis Supabase:', userLikesError.message);
                return false; // Retourner false en cas d'erreur ou si l'utilisateur n'a pas aimé le post
            }

            return userLikesData.length > 0; // Vrai si l'utilisateur a aimé le post, faux sinon
        });

        // Attendre que toutes les requêtes pour les likes de l'utilisateur soient terminées
        const userLikesResults = await Promise.all(userLikesPromises);

        // Ajouter l'information si l'utilisateur a aimé chaque post
        allPostsData.forEach((post, index) => {
            post.userLiked = userLikesResults[index];
        });

        // Sélectionner un commentaire aléatoire pour chaque post
        const randomCommentsPromises = allPostsData.map(async post => {
            const { data: randomCommentData, error: randomCommentError } = await supabase
                .from('comments')
                .select('comment')
                .eq('post_id', post.id)
                .limit(1)

            if (randomCommentError) {
                console.error('Erreur lors de la récupération d\'un commentaire aléatoire depuis Supabase:', randomCommentError.message);
                return null; // Retourner null en cas d'erreur
            }

            return (randomCommentData && randomCommentData[0] && randomCommentData[0].comment) || null;

        });

        // Attendre que toutes les requêtes pour les commentaires aléatoires soient terminées
        const randomCommentsResults = await Promise.all(randomCommentsPromises);

        // Ajouter le commentaire aléatoire à chaque post
        allPostsData.forEach((post, index) => {
            post.randomComment = randomCommentsResults[index];
        });

        // Récupérer le nombre de commentaires pour chaque post depuis la table comments
        const commentsPromises = allPostsData.map(async post => {
            const { data: commentsData, error: commentsError } = await supabase
                .from('comments')
                .select('id')
                .eq('post_id', post.id);

            if (commentsError) {
                console.error('Erreur lors de la récupération des commentaires depuis Supabase:', commentsError.message);
                return 0; // Retourner 0 commentaires en cas d'erreur
            }

            return commentsData.length; // Nombre de commentaires pour ce post
        });

        // Attendre que toutes les requêtes pour les commentaires soient terminées
        const commentsResults = await Promise.all(commentsPromises);

        // Ajouter le nombre de commentaires à chaque post
        allPostsData.forEach((post, index) => {
            post.commentsCount = commentsResults[index];
        });

        
        // Insérer un post publicitaire (ads) après chaque groupe de deux posts
        // const postsWithAds = [];
        // for (let i = 0; i < allPostsData.length; i++) {
        //     postsWithAds.push(allPostsData[i]);
        
        //     if ((i + 1) % 4 === 0 && i !== allPostsData.length - 1) {
        //         // Récupérer un post publicitaire aléatoire dont la date actuelle est comprise entre la start_date et la end_date
        //         const { data: adsData, error: adsError } = await supabase
        //             .from('posts')
        //             .select('id, ad_title, text, ad_type, src, uuid, website, start_date, end_date, created_at')
        //             .lt('start_date', new Date().toISOString()) // `start_date` doit être inférieure ou égale à aujourd'hui
        //             .gt('end_date', new Date().toISOString())   // `end_date` doit être supérieure ou égale à aujourd'hui
        //             .eq('ad', true)
        //             .limit(1)
        //             .maybeSingle()
        
        //         if (adsError) {
        //             console.error('Erreur lors de la récupération du post publicitaire depuis Supabase:', adsError.message);
        //             return res.status(500).send(adsError);
        //         }
        
        //         const adData = adsData; // Récupérer les données du post publicitaire
        
        //         // Récupérer les informations de l'utilisateur qui a posté le post publicitaire
        //         const { data: userData, error: userError } = await supabase
        //             .from('users_infos')
        //             .select('username, avatar, badge, image_updated_at') // Ajouter les champs que vous souhaitez récupérer
        //             .eq('uuid', adData.uuid)
        //             .single();
        
        //         if (userError) {
        //             console.error('Erreur lors de la récupération des informations utilisateur depuis Supabase:', userError.message);
        //             return res.status(500).send('Erreur lors de la récupération des informations utilisateur depuis Supabase.');
        //         }

        //         const {data: userLiked, error: userLikedError} = await supabase
        //             .from('like')
        //             .select()
        //             .eq('post_id', adData.id)
        //             .eq('user_id', uuid)

        //         const hasLiked = userLiked && userLiked.length > 0;


                
        
        //         // Ajouter les informations de l'utilisateur à l'annonce publicitaire
        //         postsWithAds.push({
        //             id: adData.id,
        //             src: adData.src,
        //             text: adData.description,
        //             type: adData.ad_type,
        //             uuid: adData.uuid,
        //             title: adData.ad_title,
        //             metadata: adData.metadata,
        //             ad: true,
        //             website: adData.website,
        //             user: { username: userData.username, avatar: userData.avatar, badge: userData.badge, updated_at: userData.image_updated_at },
        //             userLiked: hasLiked,
        //         });
        //     }
        // }



        res.status(200).json({ posts: allPostsData });
    } catch (error) {
        console.error('Erreur:', error.message);
        res.status(500).send('Erreur lors de la récupération des données depuis Supabase.');
    }
});




route.get('/api/shorts/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Récupérer tous les posts des utilisateurs suivis depuis la table posts
        const { data: allPostsData, error: allPostsError } = await supabase
            .from('posts')
            .select('id, src, text, type, uuid') // Ajouter uuid pour récupérer l'ID de l'utilisateur associé à chaque post
            .eq('type', 'video')

        if (allPostsError) {
            console.error('Erreur lors de la récupération des posts depuis Supabase:', allPostsError.message);
            return res.status(500).send('Erreur lors de la récupération des posts depuis Supabase.');
        }

        // Récupérer les informations de chaque utilisateur qui a posté un message
        const usersInfoPromises = allPostsData.map(async post => {
            const { data: userInfo, error: userError } = await supabase
                .from('users_infos')
                .select('uuid, username, avatar, badge, image_updated_at')
                .eq('uuid', post.uuid)
                .single();

            if (userError) {
                console.error('Erreur lors de la récupération des informations utilisateur depuis Supabase:', userError.message);
                return null; // Ignorer cet utilisateur s'il y a une erreur
            }

            return { username: userInfo.username, avatar: userInfo.avatar, badge: userInfo.badge };
        });

        // Attendre que toutes les requêtes pour les informations des utilisateurs soient terminées
        const usersInfoResults = await Promise.all(usersInfoPromises);

        // Ajouter les informations de l'utilisateur à chaque post
        allPostsData.forEach((post, index) => {
            post.user = usersInfoResults[index];
        });

        // Récupérer le nombre de likes pour chaque post depuis la table likes
        const likesPromises = allPostsData.map(async post => {
            const { data: likesData, error: likesError } = await supabase
                .from('like')
                .select('id')
                .eq('post_id', post.id);

            if (likesError) {
                console.error('Erreur lors de la récupération des likes depuis Supabase:', likesError.message);
                return 0; // Retourner 0 likes en cas d'erreur
            }

            return likesData.length; // Nombre de likes pour ce post
        });

        // Attendre que toutes les requêtes pour les likes soient terminées
        const likesResults = await Promise.all(likesPromises);

        // Ajouter le nombre de likes à chaque post
        allPostsData.forEach((post, index) => {
            post.likesCount = likesResults[index];
        });


        
        // Vérifier si l'utilisateur a déjà aimé chaque post
        const userLikesPromises = allPostsData.map(async post => {
            const { data: userLikesData, error: userLikesError } = await supabase
                .from('like')
                .select('id')
                .eq('post_id', post.id)
                .eq('user_id', userId);

            if (userLikesError) {
                console.error('Erreur lors de la récupération des likes de l\'utilisateur depuis Supabase:', userLikesError.message);
                return false; // Retourner false en cas d'erreur ou si l'utilisateur n'a pas aimé le post
            }

            return userLikesData.length > 0; // Vrai si l'utilisateur a aimé le post, faux sinon
        });

        // Attendre que toutes les requêtes pour les likes de l'utilisateur soient terminées
        const userLikesResults = await Promise.all(userLikesPromises);

        // Ajouter l'information si l'utilisateur a aimé chaque post
        allPostsData.forEach((post, index) => {
            post.userLiked = userLikesResults[index];
        });

        // Sélectionner un commentaire aléatoire pour chaque post
        const randomCommentsPromises = allPostsData.map(async post => {
            const { data: randomCommentData, error: randomCommentError } = await supabase
                .from('comments')
                .select('comment')
                .eq('post_id', post.id)
                .limit(1)

            if (randomCommentError) {
                console.error('Erreur lors de la récupération d\'un commentaire aléatoire depuis Supabase:', randomCommentError.message);
                return null; // Retourner null en cas d'erreur
            }

            return (randomCommentData && randomCommentData[0] && randomCommentData[0].comment) || null;

        });

        // Attendre que toutes les requêtes pour les commentaires aléatoires soient terminées
        const randomCommentsResults = await Promise.all(randomCommentsPromises);

        // Ajouter le commentaire aléatoire à chaque post
        allPostsData.forEach((post, index) => {
            post.randomComment = randomCommentsResults[index];
        });

        // Récupérer le nombre de commentaires pour chaque post depuis la table comments
        const commentsPromises = allPostsData.map(async post => {
            const { data: commentsData, error: commentsError } = await supabase
                .from('comments')
                .select('id')
                .eq('post_id', post.id);

            if (commentsError) {
                console.error('Erreur lors de la récupération des commentaires depuis Supabase:', commentsError.message);
                return 0; // Retourner 0 commentaires en cas d'erreur
            }

            return commentsData.length; // Nombre de commentaires pour ce post
        });

        // Attendre que toutes les requêtes pour les commentaires soient terminées
        const commentsResults = await Promise.all(commentsPromises);

        // Ajouter le nombre de commentaires à chaque post
        allPostsData.forEach((post, index) => {
            post.commentsCount = commentsResults[index];
        });

        
        // Insérer un post publicitaire (ads) après chaque groupe de deux posts
        const postsWithAds = [];
        for (let i = 0; i < allPostsData.length; i++) {
            postsWithAds.push(allPostsData[i]);
            if ((i + 1) % 4 === 0 && i !== allPostsData.length - 1) {
                // Récupérer un post publicitaire (ads) aléatoire depuis la table adsrandom
                const { data: adsData, error: adsError } = await supabase
                    .from('ads_random')
                    .select('id, title, description, ad_type, src, uuid, website, country')
                    .limit(1);

                if (adsError) {
                    console.error('Erreur lors de la récupération du post publicitaire depuis Supabase:', adsError.message);
                    return res.status(500).send(adsError);
                }

                const adData = adsData[0]; // Récupérer les données du post publicitaire

                // Récupérer les informations de l'utilisateur qui a posté le post publicitaire
                const { data: userData, error: userError } = await supabase
                    .from('users_infos')
                    .select('username, avatar, badge') // Ajouter les champs que vous souhaitez récupérer
                    .eq('uuid', adData.uuid)
                    .single();

                if (userError) {
                    console.error('Erreur lors de la récupération des informations utilisateur depuis Supabase:', userError.message);
                    return res.status(500).send('Erreur lors de la récupération des informations utilisateur depuis Supabase.');
                }

                // Ajouter les informations de l'utilisateur à l'annonce publicitaire
                postsWithAds.push({
                    id: adData.id,
                    uuid: adData.uuid,
                    title: adData.title,
                    content: adData.description,
                    type: adData.ad_type,
                    url: adData.URL,
                    website: adData.website,
                    user: {uuid: userData.uuid, username: userData.username, avatar: userData.avatar, badge: userData.badge }
                });
            }
        }


        res.status(200).json({ posts: postsWithAds });
    } catch (error) {
        console.error('Erreur:', error.message);
        res.status(500).send('Erreur lors de la récupération des données depuis Supabase.');
    }
});




route.get('/exploare', async (req, res) => {
  try {
    // Sélectionner tous les posts avec les informations de l'utilisateur associé
    const { data, error } = await supabase
      .from('posts')
      .select(`uuid, src`)
      .eq('type', 'post')

    if (error) {
      throw error;
    }

    // Retourner les données avec les informations utilisateur
    res.status(200).json(data);
  } catch (error) {
    console.error('Erreur lors de la récupération des posts :', error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des posts' });
  }
});


route.post('/api/save-close-friends/:userId', async (req, res) => {
  const { userId } = req.params;
  const { friends } = req.body;

  try {
    if (!Array.isArray(friends) || friends.length === 0) {
      return res.status(400).json({ error: 'No friends provided' });
    }

    // Pour chaque ami, on met à jour la colonne `closed_friend` dans la table `follow`
    for (const friend of friends) {
      const { toid, closed_friend } = friend;  // `toid` est l'ID de l'ami et `closed_friend` est true ou false

      // Mise à jour de la colonne `closed_friend` dans la table `follow`
      let { error } = await supabase
        .from('follow')
        .update({ closed_friend })
        .eq('fromid', userId)
        .eq('toid', toid);

      if (error) {
        throw error;  // S'il y a une erreur, on arrête l'opération
      }
    }

    // Répondre avec succès si tout s'est bien passé
    res.status(200).json({ message: 'Close Friends updated successfully!' });

  } catch (error) {
    // En cas d'erreur, retourner une réponse avec le message d'erreur
    res.status(500).json({ error: error.message });
  }
});


route.get('/api/friends/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. Fetcher les utilisateurs suivis par `fromId` depuis la table `follow`
    let { data: follows, error: followError } = await supabase
      .from('follow')
      .select('toid, closed_friend')
      .eq('fromid', userId);

    if (followError) throw followError;

    // 2. Extraire les `toId` pour récupérer les informations des utilisateurs suivis
    const toIds = follows.map(follow => follow.toid);

    // 3. Fetcher les informations des utilisateurs suivis depuis la table `users_infos`
    let { data: users, error: userError } = await supabase
      .from('users_infos')
      .select('uuid, avatar, username')
      .in('uuid', toIds);  // Assurer que `uuid` correspond bien à `toid`

    if (userError) throw userError;

    // 4. Associer `closed_friend` à chaque utilisateur
    const usersWithFriendsStatus = users.map(user => {
      // Trouver l'entrée correspondante dans `follows`
      const follow = follows.find(f => f.toid === user.uuid);

      // Si `follow` existe, on associe `closed_friend`, sinon on laisse false par défaut
      return {
        ...user,
        closed_friend: follow ? follow.closed_friend : false
      };
    });

    // 5. Retourner la réponse avec les informations des utilisateurs suivis et `closed_friend`
    res.status(200).json(usersWithFriendsStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





route.get('/api/comments/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        

        const {data: CommentsData, error: CommentsError} = await supabase.from('comments').select('id, comment, uuid').eq('post_id', postId);

        if (CommentsError) {
            console.error('Erreur lors de la récupération des comments depuis Supabase:', CommentsError.message);
            return res.status(500).send('Erreur lors de la récupération des comments depuis Supabase.');
        }

        const usersInfoPromises = CommentsData.map(async comment => {
            const { data: userInfo, error: userError } = await supabase
                .from('users_infos')
                .select('username, avatar, badge')
                .eq('uuid', comment.uuid)
                .single();

            if (userError) {
                console.error('Erreur lors de la récupération des informations utilisateur depuis Supabase:', userError.message);
                return null; // Ignorer cet utilisateur s'il y a une erreur
            }

            return { username: userInfo.username, avatar: userInfo.avatar, badge: userInfo.badge };
        });

        const usersInfoResults = await Promise.all(usersInfoPromises);
        // Ajouter les informations de l'utilisateur à chaque post

        CommentsData.forEach((comment, index) => {
            comment.user = usersInfoResults[index];
        });

        res.status(200).json({ comments: CommentsData });
    } catch (error) {
        console.error('Erreur:', error.message);
        res.status(500).send('Erreur lors de la récupération des données depuis Supabase.');
    }
});


route.get('/api/posts/popular/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Récupérer tous les posts avec la colonne total_engagement
        const { data: allPostsData, error: allPostsError } = await supabase
            .from('post')
            .select('id, src, text, type, uuid, total_engagement'); // Inclure total_engagement

        if (allPostsError) {
            console.error('Erreur lors de la récupération des posts depuis Supabase:', allPostsError.message);
            return res.status(500).send('Erreur lors de la récupération des posts depuis Supabase.');
        }

        // Récupérer le nombre de likes et vérifier si l'utilisateur a liké chaque post
        const likesPromises = allPostsData.map(async post => {
            try {
                const { data: likesData, error: likesError } = await supabase
                    .from('like')
                    .select('id, user_id')
                    .eq('post_id', post.id);

                if (likesError) throw new Error(likesError.message);

                const isLikedByUser = likesData.some(like => like.user_id === userId);

                // Retourner l'information pour chaque post
                return {
                    post,
                    isLikedByUser
                };
            } catch (error) {
                console.error('Erreur lors du traitement d\'un post:', error.message);
                return null; // Retourner null en cas d'erreur pour ce post
            }
        });

        const postsWithLikes = await Promise.all(likesPromises);
        const validPostsWithLikes = postsWithLikes.filter(post => post !== null);

        // Trier les posts par engagement total (utiliser la colonne total_engagement)
        validPostsWithLikes.sort((a, b) => b.post.total_engagement - a.post.total_engagement);
        const popularPosts = validPostsWithLikes.slice(0, 10);

        // Récupérer les informations des utilisateurs pour chaque post populaire
        const usersInfoPromises = popularPosts.map(async postWithLikes => {
            const post = postWithLikes.post;
            try {
                const { data: userInfo, error: userError } = await supabase
                    .from('users_infos')
                    .select('username, avatar, badge, image_updated_at')
                    .eq('uuid', post.uuid)
                    .single();

                if (userError) throw new Error(userError.message);

                return { username: userInfo.username, avatar: userInfo.avatar, badge: userInfo.badge, updated_at: userInfo.image_updated_at };
            } catch (error) {
                console.error('Erreur lors de la récupération des informations utilisateur:', error.message);
                return null; // Retourner null en cas d'erreur pour cet utilisateur
            }
        });

        const usersInfoResults = await Promise.all(usersInfoPromises);

        // Ajouter les informations utilisateur aux posts populaires
        popularPosts.forEach((postWithLikes, index) => {
            const post = postWithLikes.post;
            post.isLikedByUser = postWithLikes.isLikedByUser;

            if (usersInfoResults[index]) {
                post.user = usersInfoResults[index];
            } else {
                post.user = { username: 'Utilisateur inconnu', avatar: null, badge: null, updated_at: null };
            }
        });

        // Retourner les posts populaires
        res.status(200).json({ posts: popularPosts });
    } catch (error) {
        console.error('Erreur:', error.message);
        res.status(500).send('Erreur lors de la récupération des données depuis Supabase.');
    }
});


route.get('/api/recomanded_users/:limit', async (req, res) => {
    try {
        const { limit } = req.params;

        const { data: userData, error: userError } = await supabase
            .from('users_infos_random')
            .select('uuid, username, avatar, badge, image_updated_at, token')
            .limit(limit); // Limite à 5 utilisateurs

        if (userError) {
            throw userError;
        }

        if (!userData || userData.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json(userData);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
});


const PAYPAL_CLIENT = 'AeVNIiDH5xwPJLIPwwLnE-uooXyrggdRSsnNbHADm1XX69aHju6i1i3u8j_KDemdknyLTd42P8pYInsi';
const PAYPAL_SECRET = 'EEZsAnAxPg9vsLy7g97HyCPVxFFbR6jWhXI3JH0NajsQj6jG9MsfGDNlv3cojqqfViwaY76u-7bFhyNJ';
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';

route.post('/create-order', async (req, res) => {
    try {
      const auth = await axios.post(
        `${PAYPAL_API}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: PAYPAL_CLIENT,
            password: PAYPAL_SECRET,
          },
        }
      );
  
      const { access_token } = auth.data;
  
      // Crée l'ordre
      const order = await axios.post(
        `${PAYPAL_API}/v2/checkout/orders`,
        {
          intent: 'AUTHORIZE', // Changez en 'CAPTURE' si vous voulez capturer directement
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: '10.00', // Montant total
              },
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
  
      res.json(order.data); // Retourne l'ID de l'ordre
    } catch (error) {
      console.error('Erreur lors de la création de l\'ordre :', error.response?.data || error.message);
      res.status(500).send(error.response?.data || error.message);
    }
});


route.post('/confirm-order', async (req, res) => {
    try {
      const { orderId, card } = req.body;
  
      const auth = await axios.post(
        `${PAYPAL_API}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: PAYPAL_CLIENT,
            password: PAYPAL_SECRET,
          },
        }
      );
  
      const { access_token } = auth.data;
  
      // Confirme l'ordre avec la source de paiement
      const confirm = await axios.post(
        `${PAYPAL_API}/v2/checkout/orders/${orderId}/confirm-payment-source`,
        {
          payment_source: {
            card: {
              number: card.number,
              expiry: card.expiry,
              security_code: card.cvv,
              billing_address: {
                address_line_1: card.address,
                admin_area_2: card.city,
                admin_area_1: card.state,
                postal_code: card.postal_code,
                country_code: card.country,
              },
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
  
      res.json(confirm.data); // Renvoie les informations de la transaction
    } catch (error) {
      console.error('Erreur lors de la confirmation de l\'ordre :', error.response?.data || error.message);
      res.status(500).send(error.response?.data || error.message);
    }
});


app.use(`/.netlify/functions/api`, route);



module.exports = app;
module.exports.handler = serverless(app);